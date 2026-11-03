import type { NodeImage } from "./types";

/**
 * Las imágenes se achican y comprimen en el navegador antes de guardarlas
 * dentro del mapa: así no hace falta un servicio aparte para archivos y el
 * mapa se sigue guardando y exportando como un solo documento.
 */

/** Lado más largo guardado: nítida con zoom y en el visor en grande (una foto queda en ~100-150 KB) */
const MAX_SIDE = 960;
/** No vale la pena procesar archivos enormes (fotos RAW, etc.) */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Peso máximo de cada imagen ya comprimida (el esquema del mapa admite hasta 900.000 caracteres) */
const MAX_SRC_CHARS = 600_000;

export class ImageError extends Error {}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

export async function fileToNodeImage(file: Blob): Promise<NodeImage> {
  if (!file.type.startsWith("image/")) throw new ImageError("Ese archivo no es una imagen");
  if (file.size > MAX_FILE_BYTES) throw new ImageError("La imagen es demasiado pesada (máximo 25 MB)");
  const img = await loadImage(file);
  const iw = img.naturalWidth || 300;
  const ih = img.naturalHeight || 200;
  // Se prueba con calidad alta y, si pesa demasiado (fotos con mucho detalle), se baja
  // la calidad y después el tamaño hasta que entre: nunca debe impedir guardar el mapa.
  const attempts: [number, number][] = [
    [1, 0.82], [1, 0.7], [1, 0.58], [0.8, 0.6], [0.65, 0.6], [0.5, 0.55], [0.38, 0.5], [0.28, 0.45],
  ];
  let last: NodeImage | null = null;
  for (const [shrink, quality] of attempts) {
    const scale = Math.min(1, MAX_SIDE / Math.max(iw, ih)) * shrink;
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    last = encode(img, w, h, quality);
    if (last.src.length <= MAX_SRC_CHARS) return last;
  }
  if (last && last.src.length <= MAX_SRC_CHARS * 1.25) return last;
  throw new ImageError("No se pudo achicar la imagen lo suficiente. Probá con otra");
}

function encode(img: HTMLImageElement, w: number, h: number, quality: number): NodeImage {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("El navegador no pudo procesar la imagen");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  // webp conserva transparencias y pesa poco; si el navegador no lo soporta, jpeg
  let src = canvas.toDataURL("image/webp", quality);
  if (!src.startsWith("data:image/webp")) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    src = canvas.toDataURL("image/jpeg", quality);
  }
  return { src, w, h };
}

/** Primera imagen de un portapapeles o de un arrastre */
export function imageFileFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  for (const f of Array.from(data.files ?? [])) if (f.type.startsWith("image/")) return f;
  return null;
}
