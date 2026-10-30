"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { ChevronDown, ChevronLeft, ChevronUp, Download, Keyboard, Search, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapsApi } from "../api/client";
import { useAutosave } from "../hooks/use-autosave";
import { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts";
import { clearMeasureCache } from "../model/measure";
import { exportFileSchema, mindMapDocSchema, type ExportFile } from "../model/schema";
import type { MindMapRecord } from "../model/types";
import { useMindMap, type SaveStatus } from "../store/mindmap-store";
import { Dock } from "./dock";
import { NotePreview } from "./note-preview";
import { NoteWindows } from "./note-window";
import { ThemePicker } from "@/features/theme/theme-picker";
import { MindMapCanvas } from "./mind-map-canvas";

const STATUS_COPY: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Cambios sin guardar",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Sin conexión con el servidor. Tus cambios siguen acá y se reintenta solo",
  conflict: "Este mapa cambió en otra pestaña. Lo tuyo sigue en pantalla",
};

const SHORTCUTS: [string, string][] = [
  ["Tab", "Idea hija"],
  ["Enter", "Idea hermana"],
  ["Shift Enter", "Hermana antes"],
  ["Supr", "Borrar rama"],
  ["F2 o doble clic", "Renombrar"],
  ["Tipear", "Reemplazar texto"],
  ["/", "Plegar o desplegar la rama"],
  ["-", "Plegar todo"],
  ["+", "Desplegar un nivel"],
  ["Flechas", "Moverse entre ideas"],
  ["Esc", "Soltar la selección"],
  ["Espacio + arrastrar", "Mover el lienzo"],
  ["Rueda o pellizco", "Zoom"],
  ["Cursor sobre una idea con nota", "Ver la nota"],
  ["Clic en la vista previa", "Fijarla para escribir"],
  ["Ctrl Enter", "Abrir la nota de la idea"],
  ["Arrastrar un punto de la esquina", "Flecha de relación a otra idea"],
  ["Doble clic en la flecha", "Ponerle nombre"],
  ["Supr con la flecha elegida", "Borrar la relación"],
  ["Ctrl F", "Buscar en el mapa"],
  ["Ctrl C", "Copiar la rama como lista"],
  ["Ctrl Z", "Deshacer"],
  ["Ctrl S", "Guardar ahora"],
];

function TitleField() {
  const title = useMindMap((s) => s.title);
  return (
    <input
      aria-label="Título del mapa"
      className="mm-title"
      value={title}
      size={Math.max(8, title.length + 1)}
      maxLength={120}
      onChange={(e) => useMindMap.getState().setTitle(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function SaveIndicator({ onRetry, onKeepMine }: { onRetry: () => void; onKeepMine: () => void }) {
  const status = useMindMap((s) => s.saveStatus);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (status === "idle") return null;
  return (
    <span className={`mm-status is-${status}`} role="status">
      <i aria-hidden />
      <span className="mm-status-text" title={STATUS_COPY[status]}>{STATUS_COPY[status]}</span>
      {status === "error" && (
        <button type="button" className="mm-status-action" onClick={onRetry}>
          Reintentar ahora
        </button>
      )}
      {status === "conflict" && (
        <>
          <button type="button" className="mm-status-action is-primary" onClick={onKeepMine}>
            Guardar mi versión como copia
          </button>
          <button
            type="button"
            className="mm-status-action"
            onBlur={() => setConfirmDiscard(false)}
            onClick={() => {
              if (!confirmDiscard) return setConfirmDiscard(true);
              // marcamos "sin pendientes" para que el navegador no vuelva a preguntar al recargar
              useMindMap.getState().setSaveStatus("idle");
              window.location.reload();
            }}
          >
            {confirmDiscard ? "Sí, perder mis cambios" : "Descartar lo mío"}
          </button>
        </>
      )}
    </span>
  );
}

const normalize = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Búsqueda dentro del mapa: despliega ramas plegadas y centra cada resultado. */
function FindBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useMindMap((s) => s.nodes);
  const rootId = useMindMap((s) => s.rootId);

  // resultados en orden de lectura del árbol (DFS), incluidas las ramas plegadas
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [] as string[];
    const out: string[] = [];
    const walk = (id: string) => {
      const n = nodes[id];
      if (!n) return;
      if (normalize(n.text).includes(q) || (n.note && normalize(n.note).includes(q))) out.push(id);
      n.children.forEach(walk);
    };
    walk(rootId);
    return out;
  }, [query, nodes, rootId]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.select());
  }, [open]);

  const go = (i: number) => {
    if (!matches.length) return;
    const next = (i + matches.length) % matches.length;
    setIndex(next);
    useMindMap.getState().reveal(matches[next]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="mm-find"
          role="search"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          <Search size={15} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            placeholder="Buscar en el mapa"
            aria-label="Buscar en el mapa"
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // primer Enter muestra el resultado actual; los siguientes avanzan
                const showing = useMindMap.getState().selectedId === matches[index];
                go(e.shiftKey ? index - 1 : showing ? index + 1 : index);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <span className="mm-find-count" aria-live="polite">
            {query.trim() ? (matches.length ? `${index + 1} de ${matches.length}` : "Sin resultados") : ""}
          </span>
          <button type="button" aria-label="Resultado anterior" disabled={!matches.length} onClick={() => go(index - 1)}>
            <ChevronUp size={15} />
          </button>
          <button type="button" aria-label="Resultado siguiente" disabled={!matches.length} onClick={() => go(index + 1)}>
            <ChevronDown size={15} />
          </button>
          <button type="button" aria-label="Cerrar búsqueda" onClick={onClose}>
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Aviso breve sin acción (por ejemplo, al copiar una rama). */
function NoticeToast() {
  const notice = useMindMap((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useMindMap.getState().dismissNotice(), 2600);
    return () => clearTimeout(t);
  }, [notice]);
  return (
    <div className="mm-undo-wrap mm-notice-wrap">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.stamp}
            className="mm-undo mm-notice"
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <span>{notice.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyHint() {
  const count = useMindMap((s) => Object.keys(s.nodes).length);
  const rootSelected = useMindMap((s) => s.selectedId === s.rootId);
  return (
    <div className="mm-hint-wrap" aria-hidden={count !== 1}>
      <AnimatePresence>
        {count === 1 && (
          <motion.p
            className="mm-hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {rootSelected ? (
              <>
                Pulsá <kbd>Tab</kbd> para abrir tu primera rama, o usá las flechas al lado de la idea central
              </>
            ) : (
              <>Hacé clic en la idea central para empezar a ramificar</>
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const UNDO_TOAST_MS = 6000;

/** Aviso después de borrar: dice qué se borró y ofrece deshacer sin saber atajos. */
function UndoToast() {
  const deleted = useMindMap((s) => s.lastDeleted);
  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => useMindMap.getState().dismissDeleted(), UNDO_TOAST_MS);
    return () => clearTimeout(t);
  }, [deleted]);
  const label = deleted ? (deleted.text.length > 40 ? `${deleted.text.slice(0, 40)}…` : deleted.text) : "";
  return (
    <div className="mm-undo-wrap">
      <AnimatePresence>
        {deleted && (
          <motion.div
            key={deleted.stamp}
            className="mm-undo"
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <span>
              Borraste «{label}»
              {deleted.descendants > 0 &&
                ` y ${deleted.descendants} ${deleted.descendants === 1 ? "idea más" : "ideas más"}`}
            </span>
            <button type="button" onClick={() => useMindMap.getState().undo()}>
              Deshacer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Anuncia la idea seleccionada a lectores de pantalla (el lienzo es visual). */
function SelectionAnnouncer() {
  const message = useMindMap((s) => {
    const n = s.selectedId ? s.nodes[s.selectedId] : null;
    if (!n) return "Ninguna idea seleccionada. Flechas o Enter para volver a la idea central.";
    let depth = 0;
    for (let p = n.parentId; p; p = s.nodes[p]?.parentId ?? null) depth++;
    const kids = n.children.length;
    const parts = [
      n.text,
      depth === 0 ? "Idea central" : `Nivel ${depth}`,
      kids ? `${kids} ${kids === 1 ? "idea hija" : "ideas hijas"}${n.collapsed ? ", rama plegada" : ""}` : "Sin ideas hijas",
    ];
    return parts.join(". ");
  });
  return (
    <p className="sr-only" aria-live="polite">
      {message}
    </p>
  );
}

export function MindMapEditor({ initial }: { initial: MindMapRecord }) {
  const router = useRouter();
  const loaded = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { saveNow } = useAutosave();
  const [findOpen, setFindOpen] = useState(false);
  const openFind = useCallback(() => setFindOpen(true), []);
  const { spaceHeld } = useKeyboardShortcuts({ onSave: saveNow, onFind: openFind });

  /** Conflicto: en vez de perder lo propio, se guarda como un mapa nuevo. */
  const keepMineAsCopy = async () => {
    const s = useMindMap.getState();
    try {
      const created = await mapsApi.create({ title: `${s.title.trim() || "Mapa"} (mi versión)`.slice(0, 120), doc: s.toDoc() });
      s.setSaveStatus("idle");
      router.push(`/map/${created.id}`);
    } catch {
      setToast("No se pudo crear la copia. Exportá el mapa con el botón Exportar para no perderlo");
    }
  };

  if (!loaded.current) {
    useMindMap.getState().load({ mapId: initial.id, title: initial.title, version: initial.version, doc: initial.doc });
    loaded.current = true;
  }

  useEffect(() => {
    // Las medidas hechas con la fuente de respaldo quedan mal: re-medimos al cargar las webfonts.
    document.fonts?.ready.then(() => {
      clearMeasureCache();
      useMindMap.getState().onFontsReady();
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const exportJson = () => {
    const s = useMindMap.getState();
    const file: ExportFile = { format: "mindmap-studio", title: s.title, exportedAt: new Date().toISOString(), doc: s.toDoc() };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(s.title || "mapa").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.mindmap.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const asExport = exportFileSchema.safeParse(raw);
      const doc = asExport.success ? asExport.data.doc : mindMapDocSchema.parse(raw);
      const title = asExport.success ? asExport.data.title : file.name.replace(/\.(mindmap\.)?json$/, "");
      const created = await mapsApi.create({ title, doc });
      router.push(`/map/${created.id}`);
    } catch {
      setToast("Ese archivo no es un mapa válido. Usá un .json exportado desde Mindmap Studio");
    }
  };

  return (
    <ReactFlowProvider>
      <main className="mm-shell">
        <MindMapCanvas spaceHeld={spaceHeld} />

        <header className="mm-topbar">
          <Link href="/" className="mm-back" aria-label="Volver a tus mapas">
            <ChevronLeft size={16} />
            Mapas
          </Link>
          <TitleField />
          <SaveIndicator onRetry={() => void saveNow()} onKeepMine={() => void keepMineAsCopy()} />
        </header>

        <div className="mm-topright">
          <ThemePicker />
          <button type="button" className="mm-chip" onClick={() => setFindOpen(true)} title="Buscar en el mapa (Ctrl F)">
            <Search size={15} />
            <span>Buscar</span>
          </button>
          <button type="button" className="mm-chip mm-chip-wide" onClick={exportJson} title="Descargar este mapa como archivo .json">
            <Download size={15} />
            <span>Exportar</span>
          </button>
          <button type="button" className="mm-chip mm-chip-wide" onClick={() => fileInput.current?.click()} title="Abrir un .json como mapa nuevo">
            <Upload size={15} />
            <span>Importar</span>
          </button>
          <button type="button" className="mm-chip" aria-expanded={helpOpen} onClick={() => setHelpOpen((v) => !v)}>
            <Keyboard size={15} />
            <span>Atajos</span>
          </button>
        </div>
        <AnimatePresence>
          {helpOpen && (
            <motion.aside
              className="mm-help"
              initial={{ opacity: 0, x: 16, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <div className="mm-help-head">
                <h2>Atajos de teclado</h2>
                <button type="button" aria-label="Cerrar atajos" onClick={() => setHelpOpen(false)}>
                  <X size={15} />
                </button>
              </div>
              <dl>
                {SHORTCUTS.map(([k, v]) => (
                  <div key={k}>
                    <dt>{v}</dt>
                    <dd>
                      <kbd>{k}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.aside>
          )}
        </AnimatePresence>

        <FindBar open={findOpen} onClose={() => setFindOpen(false)} />
        <EmptyHint />
        <UndoToast />
        <NoticeToast />
        <SelectionAnnouncer />
        <Dock />
        <NotePreview />
        <NoteWindows />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = "";
          }}
        />
        <AnimatePresence>
          {toast && (
            <motion.div className="mm-toast" role="alert" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </ReactFlowProvider>
  );
}
