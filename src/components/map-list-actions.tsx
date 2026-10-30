"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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

export function DeleteMapButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      type="button"
      className={`home-delete ${confirming ? "is-confirming" : ""}`}
      aria-label={confirming ? `Confirmar borrado de ${title}` : `Borrar ${title}`}
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
