import { fileTypeFromBlob } from "file-type";

const RASTER_IMAGE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const PDF = new Set(["application/pdf"]);

export type UploadKind = "raster-image" | "raster-or-pdf" | "raster-or-video";

/**
 * Valida o tipo real (assinatura) do ficheiro, não só a extensão ou MIME do browser.
 * Documentação: Upload — validação por buffer / blob.
 */
export async function assertUploadMagicBytes(
  file: File,
  kind: UploadKind,
  maxBytes: number,
): Promise<{ mime: string }> {
  if (!file || !(file instanceof File)) {
    throw new Error("Ficheiro inválido");
  }
  if (file.size > maxBytes) {
    throw new Error(`Ficheiro demasiado grande (máx. ${Math.round(maxBytes / (1024 * 1024))} MB)`);
  }

  const head = file.slice(0, Math.min(file.size, 65536));
  const detected = await fileTypeFromBlob(head);
  const mime = detected?.mime;

  if (!mime) {
    throw new Error("Não foi possível validar o tipo do ficheiro. Use PNG, JPEG, WebP ou GIF.");
  }

  if (kind === "raster-image") {
    if (!RASTER_IMAGE.has(mime)) {
      throw new Error("Tipo de ficheiro não permitido (apenas imagens PNG, JPEG, WebP ou GIF).");
    }
    return { mime };
  }

  if (kind === "raster-or-pdf") {
    if (!RASTER_IMAGE.has(mime) && !PDF.has(mime)) {
      throw new Error("Tipo de ficheiro não permitido (imagem ou PDF).");
    }
    return { mime };
  }

  if (kind === "raster-or-video") {
    if (!RASTER_IMAGE.has(mime) && !VIDEO.has(mime)) {
      throw new Error("Tipo de ficheiro não permitido (imagem ou vídeo MP4/WebM/MOV).");
    }
    return { mime };
  }

  throw new Error("Tipo de validação desconhecido");
}

export function extensionForDetectedMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "application/pdf") return "pdf";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return "bin";
}
