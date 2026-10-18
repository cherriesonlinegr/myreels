export default async function handler(req, res) {
  const cron = req.headers["x-vercel-cron"] === "1";
  const secret = process.env.CRON_SECRET;
  const bearer = Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
  if (!cron && !bearer) return res.status(401).json({ ok: false });
  try {
    const { runDueSequences, syncLeadSheet } = await import("../lib/stay-board.mjs");
    const deals = await runDueSequences();
    let leads = 0;
    try {
      const synced = await syncLeadSheet();
      leads = synced.leads.length;
    } catch (err) {
      console.error("[myreels/leads]", err?.message || err);
    }
    return res.status(200).json({ ok: true, deals, leads });
  } catch (err) {
    console.error("[myreels/sequence]", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "Οι sequences δεν έφυγαν." });
  }
}
