"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkLeaderInitial, bulkOverrideAp } from "@/app/leader/actions";
import { Button, Card, Notice } from "@/components/ui";

type Item = { id: string; label: string };
type Result = { ok?: string; error?: string; skipped?: { item: string; why: string }[] };

/** Leaders/admins: sign several of a man's items at once — leader initials, or the AP sign-off as an override. */
export function BulkSignOff({ manId, first, ready, waitingAp }: { manId: string; first: string; ready: Item[]; waitingAp: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  const [pickReady, setPickReady] = useState<string[]>([]);
  const [pickAp, setPickAp] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  if (!ready.length && !waitingAp.length && !res) return null;

  const run = (f: () => Promise<Result>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    start(async () => {
      const r = await f();
      setRes(r);
      setPickReady([]); setPickAp([]);
      router.refresh();
    });
  };

  return (
    <Card className="space-y-5 text-sm">
      <div>
        <h2 className="text-gold">Bulk sign-off</h2>
        <p className="text-muted">Sign several of {first}&apos;s items at once. Each one goes through the same checks as signing it alone; anything that can&apos;t be signed is skipped and listed.</p>
      </div>
      {ready.length > 0 && (
        <Group title={`Ready for leader initials (${ready.length})`} items={ready} picked={pickReady} setPicked={setPickReady}>
          <Button type="button" disabled={pending || !pickReady.length}
            onClick={() => run(() => bulkLeaderInitial(manId, pickReady), `Give leader initials on ${pickReady.length} item(s) for ${first}?`)}>
            Initial selected as leader
          </Button>
        </Group>
      )}
      {waitingAp.length > 0 && (
        <Group title={`Waiting on AP (${waitingAp.length})`} items={waitingAp} picked={pickAp} setPicked={setPickAp}>
          <div className="w-full space-y-2">
            <label className="lbl" htmlFor="bulk-reason">Reason for the AP override (required, one for all)</label>
            <textarea id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
              className="field min-h-16" placeholder="e.g. Went over all of these with him myself; his AP is away" />
            <Button type="button" variant="ghost" disabled={pending || !pickAp.length || !reason.trim()}
              onClick={() => run(() => bulkOverrideAp(manId, pickAp, reason), `Sign the AP column on ${pickAp.length} item(s) for ${first} as a leader override?`)}>
              Override AP for selected
            </Button>
            <p className="text-xs text-muted">Items you override need a different leader for the leader initials (two-person rule).</p>
          </div>
        </Group>
      )}
      {pending && <p className="text-muted">Working…</p>}
      {res?.ok && <Notice>{res.ok}</Notice>}
      {res?.error && <Notice tone="danger">{res.error}</Notice>}
      {!!res?.skipped?.length && (
        <Notice tone="orange">
          <p className="font-semibold">Skipped {res.skipped.length}:</p>
          <ul className="mt-1 space-y-0.5">{res.skipped.map((s, i) => <li key={i}>{s.item} — {s.why}</li>)}</ul>
        </Notice>
      )}
    </Card>
  );
}

function Group({ title, items, picked, setPicked, children }: {
  title: string; items: Item[]; picked: string[]; setPicked: (v: string[]) => void; children: React.ReactNode;
}) {
  const all = picked.length === items.length;
  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3">
      <legend className="px-1 font-semibold text-ink">{title}</legend>
      <label className="flex items-center gap-2 text-muted">
        <input type="checkbox" checked={all} onChange={() => setPicked(all ? [] : items.map((i) => i.id))} className="accent-gold" /> Select all
      </label>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((i) => (
          <label key={i.id} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 accent-gold" checked={picked.includes(i.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))} />
            <span>{i.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>
    </fieldset>
  );
}
