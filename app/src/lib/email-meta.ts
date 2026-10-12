/**
 * What email_log keeps about a sent email: the template, the dedupe key and
 * the program step it was about. Never note text, phone numbers or names.
 */
export function emailLogMeta(template: string, opts: { dedupeKey?: string; stepId?: string } = {}) {
  return { template, dedupe: opts.dedupeKey ?? null, step_id: opts.stepId ?? null };
}
