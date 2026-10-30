"use client";

import { getBezierPath, Position, useInternalNode, type EdgeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { memo } from "react";
import { accentOf } from "../model/palette";
import { depthOf } from "../model/tree";
import { useMindMap } from "../store/mindmap-store";

/**
 * Conexión "flotante": calcula sus extremos desde la geometría real de los
 * nodos (no desde handles fijos), así funciona igual en los tres layouts.
 * Trazo Bézier cúbico con gradiente padre→hijo y un pulso que viaja por la
 * curva cuando alguno de sus extremos está activo.
 */
function BranchEdgeImpl({ id, source, target }: EdgeProps) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const mode = useMindMap((st) => st.layoutMode);
  const srcIsRoot = useMindMap((st) => st.rootId === source);
  const color = useMindMap((st) => st.nodes[target]?.color ?? 0);
  const srcColor = useMindMap((st) => st.nodes[source]?.color ?? 0);
  const depth = useMindMap((st) => depthOf(st.nodes, target));
  const active = useMindMap(
    (st) => [st.selectedId, st.editingId].includes(target) || [st.selectedId, st.editingId].includes(source),
  );
  if (!s || !t) return null;

  const sw = s.measured.width ?? 0, sh = s.measured.height ?? 0;
  const tw = t.measured.width ?? 0, th = t.measured.height ?? 0;
  if (!sw || !tw) return null;
  const sp = s.internals.positionAbsolute;
  const tp = t.internals.positionAbsolute;
  const sc = { x: sp.x + sw / 2, y: sp.y + sh / 2 };
  const tc = { x: tp.x + tw / 2, y: tp.y + th / 2 };
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;
  const horizontal = mode === "map" ? true : mode === "tree" ? false : Math.abs(dx) >= Math.abs(dy);

  let sx, sy, tx, ty, sPos, tPos;
  if (horizontal) {
    const right = dx >= 0;
    sx = right ? sp.x + sw : sp.x;
    tx = right ? tp.x : tp.x + tw;
    sy = sc.y;
    ty = tc.y;
    sPos = right ? Position.Right : Position.Left;
    tPos = right ? Position.Left : Position.Right;
  } else {
    const down = dy >= 0;
    sy = down ? sp.y + sh : sp.y;
    ty = down ? tp.y : tp.y + th;
    sx = sc.x;
    tx = tc.x;
    sPos = down ? Position.Bottom : Position.Top;
    tPos = down ? Position.Top : Position.Bottom;
  }

  const [path] = getBezierPath({
    sourceX: sx, sourceY: sy, sourcePosition: sPos,
    targetX: tx, targetY: ty, targetPosition: tPos,
    curvature: 0.32,
  });

  const from = accentOf(srcColor, srcIsRoot);
  const to = accentOf(color);
  const width = depth <= 1 ? 2.8 : depth === 2 ? 2 : 1.5;
  const gid = `mm-grad-${id}`;

  return (
    <g className="mm-edge">
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={tx} y2={ty}>
          <stop offset="0" style={{ stopColor: from, stopOpacity: srcIsRoot ? 0.5 : 0.85 }} />
          <stop offset="1" style={{ stopColor: to, stopOpacity: 0.95 }} />
        </linearGradient>
      </defs>
      {active && <path d={path} fill="none" style={{ stroke: to }} strokeWidth={width + 7} strokeOpacity={0.16} className="mm-edge-glow" />}
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={width}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
      {active && (
        <circle r={width + 0.6} style={{ fill: to, color: to }} className="mm-edge-pulse">
          <animateMotion dur="1.6s" repeatCount="indefinite" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
        </circle>
      )}
    </g>
  );
}

export const BranchEdge = memo(BranchEdgeImpl);
