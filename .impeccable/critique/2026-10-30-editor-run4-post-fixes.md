---
target: Mindmap Studio editor + lista de mapas
total_score: 34
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
method: degraded single-context (sin subagentes; detector bloqueado). Re-puntuación después de onboard/harden/clarify sobre la crítica 3.
---
# Re-crítica 4 — 2026-10-30

Puntajes: 1=4 2=3 3=4 4=3 5=4 6=3 7=4 8=3 9=3 10=3 → 34/40 (Bueno). Tendencia 28 → 32 → 30 → 34.

## Resuelto
- Mapa nuevo o vacío abre con la idea central en edición (texto seleccionado).
- Conflicto: "Guardar mi versión como copia" (crea mapa "(mi versión)") o "Descartar lo mío" con confirmación; el navegador avisa al cerrar en conflicto.
- Plegar/desplegar fuera del historial; deshacer conserva el plegado actual.
- Botones apagados explican el motivo (aria-disabled + tooltip).
- Ctrl C copia la rama como lista Markdown con sangría; aviso "Rama copiada".
- Ctrl F / botón Buscar: búsqueda sin acentos, despliega ancestros y centra el resultado; Enter avanza, Shift+Enter retrocede.
- Celular: errores de guardado y conflictos visibles como franja (antes el estado estaba oculto); exportar/importar ocultos para dar lugar al título.

## Pendiente
- Fusión automática de conflictos (hoy: copia o descarte).
- Ideas enfocables una por una con Tab.
- Modo repaso dedicado (descartado por ahora).
