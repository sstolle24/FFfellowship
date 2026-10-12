/** Turn-in file types. Mirrors the submissions bucket's allowed_mime_types (0004). */
export const TURN_IN_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
};
export const TURN_IN_MAX_BYTES = 20 * 1024 * 1024;

/** Content type for an upload, from its extension (browsers often leave HEIC/RTF blank). */
export function turnInType(fileName: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase();
  return (ext && TURN_IN_TYPES[ext]) || null;
}
