export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { handleMail } = await import("../lib/mailbox.mjs");
    return await handleMail(req, res);
  } catch (err) {
    console.error("[myreels/mail] boot", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Το ταχυδρομείο δεν άνοιξε.",
    });
  }
}
