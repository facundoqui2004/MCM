/**
 * Los colores de rama viven en CSS (tokens --branch-0…5 de cada tema), así un
 * cambio de tema recolorea el mapa sin tocar los datos: cada idea sólo guarda
 * el índice de su color.
 */
export const BRANCH_COUNT = 6;

/** Nombres de referencia del tema principal (papel), útiles para la UI */
export const BRANCH_NAMES = ["Coral", "Verde agua", "Violeta", "Ámbar", "Azul", "Rosa"] as const;

export function accentOf(colorIndex: number, isRoot = false): string {
  if (isRoot) return "var(--root-accent)";
  return `var(--branch-${((colorIndex % BRANCH_COUNT) + BRANCH_COUNT) % BRANCH_COUNT})`;
}
