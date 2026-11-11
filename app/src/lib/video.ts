/**
 * A YouTube or Vimeo link as an embeddable player URL (privacy-enhanced
 * youtube-nocookie.com), or null if it isn't one we recognize.
 */
export function videoEmbedUrl(link: string | null | undefined): string | null {
  if (!link) return null;
  let u: URL;
  try { u = new URL(link); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com") {
    id = u.searchParams.get("v") ?? (/^\/(embed|shorts|live)\/([\w-]+)/.exec(u.pathname)?.[2] ?? null);
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(?:video\/)?(\d{5,12})(?:\/([0-9a-f]{6,20}))?/.exec(u.pathname);
    if (m) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
  }
  return null;
}
