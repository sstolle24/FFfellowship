/**
 * The visitor's IP for rate limiting. On Netlify, `x-nf-client-connection-ip`
 * is set by the edge from the TCP connection and can't be forged by the
 * client, unlike the first hop of `x-forwarded-for`, which is only used as a
 * fallback on other hosts (e.g. local dev, Vercel).
 */
export function clientIpFrom(h: { get(name: string): string | null }): string | null {
  const nf = h.get("x-nf-client-connection-ip")?.trim();
  if (nf) return nf;
  if (process.env.NETLIFY) return null; // on Netlify, trust nothing else
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip")?.trim() || null;
}

/**
 * Wraps the database rate limiter. `failClosed` refuses when the limiter
 * itself errors (sign-up); otherwise a limiter outage doesn't lock people out.
 */
export async function checkLimit(
  hit: () => PromiseLike<{ data: unknown; error: unknown }>,
  failClosed: boolean,
): Promise<boolean> {
  try {
    const { data, error } = await hit();
    if (error) return !failClosed;
    return data !== false;
  } catch {
    return !failClosed;
  }
}
