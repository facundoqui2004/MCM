"use client";

import { CloudUpload, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mapsApi } from "@/features/mindmap/api/client";
import { createSampleDoc } from "@/features/mindmap/model/factory";

export function NewMapButtons({ showSample }: { showSample: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"blank" | "sample" | null>(null);

  const create = async (kind: "blank" | "sample") => {
    setBusy(kind);
    try {
      const map =
        kind === "sample"
          ? await mapsApi.create({ title: "Lanzar Mindmap Studio", doc: createSampleDoc() })
          : await mapsApi.create({ title: "Idea central" });
      router.push(`/map/${map.id}`);
    } catch {
      setBusy(null);
    }
  };

  return (
    <div className="home-actions">
      <motion.button
        type="button"
        className="home-btn is-primary"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 24 }}
        disabled={!!busy}
        onClick={() => create("blank")}
      >
        {busy === "blank" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        Crear mapa
      </motion.button>
      {showSample && (
        <motion.button
          type="button"
          className="home-btn"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          disabled={!!busy}
          onClick={() => create("sample")}
        >
          {busy === "sample" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Abrir un ejemplo
        </motion.button>
      )}
    </div>
  );
}

export function DeleteMapButton({ id, title, toTrash = false }: { id: string; title: string; toTrash?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      type="button"
      className={`home-delete ${confirming ? "is-confirming" : ""}`}
      aria-label={confirming ? `Confirmar borrado de ${title}` : `Borrar ${title}`}
      title={toTrash ? "Va a la papelera de tu Google Drive (se puede recuperar desde ahí)" : undefined}
      onBlur={() => setConfirming(false)}
      onClick={async (e) => {
        e.preventDefault();
        if (!confirming) return setConfirming(true);
        await mapsApi.remove(id);
        router.refresh();
      }}
    >
      <Trash2 size={14} />
      {confirming && <span>Borrar</span>}
    </button>
  );
}

/** Copia un mapa guardado en el sitio (sin cuenta) al Google Drive del usuario y lo abre */
export function CopyToDriveButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  return (
    <button
      type="button"
      className={`home-copy ${state === "error" ? "is-error" : ""}`}
      aria-label={`Copiar ${title} a mi Google Drive`}
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        try {
          const res = await fetch(`/api/maps/${id}/to-drive`, { method: "POST" });
          if (!res.ok) throw new Error();
          const { id: newId } = (await res.json()) as { id: string };
          router.push(`/map/${newId}`);
        } catch {
          setState("error");
        }
      }}
    >
      {state === "busy" ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
      <span>{state === "error" ? "No se pudo, reintentar" : "Copiar a mi Drive"}</span>
    </button>
  );
}
