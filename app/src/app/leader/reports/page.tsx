import { Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "Reports" };

const REPORTS: [string, string, string][] = [
  ["members", "Members", "Everyone with status, role, stage, day count, program start, last active, primary leader."],
  ["progress", "Program progress", "One row per man: Key 1/2/3 status, Key 2 items signed off, turn-ins, AP and sponsor."],
  ["ninety", "90 in 90", "Meetings logged per man since program start."],
  ["milestones", "Milestones", "Detox-21, keys complete, certified, certified another, ministry eligible — with dates."],
  ["audit", "Audit log", "Approvals, returns, role and relationship changes, data exports (last 5,000)."],
];

export default function Reports() {
  return (
    <div className="max-w-3xl">
      <SectionTitle sub="CSV downloads. Every export is recorded in the audit log.">Reports</SectionTitle>
      <div className="space-y-3">
        {REPORTS.map(([k, t, d]) => (
          <Card key={k} className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1"><div className="display text-ink">{t}</div><p className="text-sm text-muted">{d}</p></div>
            <a href={`/leader/reports/${k}`} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-gold">Download CSV</a>
          </Card>
        ))}
      </div>
    </div>
  );
}
