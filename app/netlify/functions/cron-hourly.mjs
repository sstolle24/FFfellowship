// Netlify scheduled function → /api/cron/hourly (needs CRON_SECRET in site env vars; Netlify sets URL).
export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/hourly`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(await res.text(), { status: res.status });
};
export const config = { schedule: "0 * * * *" };
