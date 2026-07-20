/**
 * MyReels lead form → Resend email
 * Vercel project: myreels (myreels.gr ONLY)
 * Do NOT copy env vars from cherriesonline
 */
import { Resend } from "resend";

const SERVICE_LABELS = {
  content: "Διαχείριση Social Media",
  videos: "AI Avatar Videos",
  maps: "Google My Business",
  avatar: "AI Avatar Videos",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "MyReels <onboarding@resend.dev>";
  const to = process.env.LEAD_NOTIFY_EMAIL;

  if (!apiKey || !to) {
    return res.status(500).json({
      ok: false,
      error: "Missing RESEND_API_KEY or LEAD_NOTIFY_EMAIL on Vercel project myreels",
    });
  }

  const body = req.body || {};
  const name = String(body.name || "").trim();
  const business = String(body.business || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const source = String(body.source || "landing").trim();
  const notes = String(body.notes || "").trim();
  const services = Array.isArray(body.services) ? body.services.map(String) : [];

  if (!name || !business || !email) {
    return res.status(400).json({
      ok: false,
      error: "Όνομα, επιχείρηση και email είναι υποχρεωτικά",
    });
  }

  const serviceLine = services.length
    ? services.map((id) => SERVICE_LABELS[id] || id).join(", ")
    : "Δεν επιλέχθηκε";

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      reply_to: email,
      subject: `[MyReels Lead] ${name} — ${business}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#1d1d1f">
          <h2 style="margin:0 0 12px">Νέο lead — MyReels</h2>
          <p style="margin:0 0 16px;color:#6e6e73">Πηγή: <strong>${source}</strong> · myreels.gr</p>
          <p><strong>Όνομα:</strong> ${name}</p>
          <p><strong>Επιχείρηση:</strong> ${business}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Τηλέφωνο:</strong> ${phone || "—"}</p>
          <p><strong>Υπηρεσίες:</strong> ${serviceLine}</p>
          <p><strong>Σημειώσεις:</strong> ${notes || "—"}</p>
        </div>
      `,
    });

    if (error) {
      return res.status(502).json({ ok: false, error: error.message || "Resend error" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Send failed" });
  }
}
