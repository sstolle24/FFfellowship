// Netlify scheduled function → /api/cron/weekly-leader (needs CRON_SECRET in site env vars; Netlify sets URL).
export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/weekly-leader`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(await res.text(), { status: res.status });
};
export const config = { schedule: "0 14 * * 1" };
