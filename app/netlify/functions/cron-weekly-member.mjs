// Netlify scheduled function → /api/cron/weekly-member (needs CRON_SECRET in site env vars; Netlify sets URL).
export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/weekly-member`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(await res.text(), { status: res.status });
};
export const config = { schedule: "0 15 * * 0" };
