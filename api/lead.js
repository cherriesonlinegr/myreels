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
  stay: "Reel καταλύματος",
  stay5: "Πακέτο 5 Reels + προγραμματισμός",
  stay10: "Πακέτο 10 Reels + προγραμματισμός",
};

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const priceNet = Number(String(body.priceNet ?? "").replace(",", "."));
  const reelNet =
    Number.isFinite(priceNet) && priceNet > 0 && priceNet <= 100000
      ? Math.round(priceNet * 100) / 100
      : source === "upsell"
        ? 170
        : 40;
  const reelGross = Math.round(reelNet * 1.24 * 100) / 100;
  const reelPriceLabel = new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: Math.round(reelGross * 100) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(reelGross) + "€";
  const pack = Number(body.pack);
  const packLabel = pack === 5 || pack === 10 ? `${pack} Reels` : "";
  let driveUrl = "";
  try {
    const parsed = new URL(String(body.driveUrl || "").trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (parsed.protocol === "https:" && (host === "drive.google.com" || host === "docs.google.com")) {
      driveUrl = parsed.toString();
    }
  } catch {
    driveUrl = "";
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: email,
      subject:
        source === "upsell"
          ? `[MyReels Upsell] ${name} — ${business} — ${packLabel || "πακέτο"} — ${reelPriceLabel}`
          : source === "reel"
            ? `[MyReels Παραγγελία] ${name} — ${business} — ${reelPriceLabel}`
            : `[MyReels Lead] ${name} — ${business}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#1d1d1f">
          <h2 style="margin:0 0 12px">${
            source === "upsell"
              ? "Upsell Reels καταλύματος"
              : source === "reel"
                ? "Παραγγελία Reel καταλύματος"
                : "Νέο lead — MyReels"
          }</h2>
          <p style="margin:0 0 16px;color:#6e6e73">Πηγή: <strong>${esc(source)}</strong> · myreels.gr</p>
          <p><strong>Όνομα:</strong> ${esc(name)}</p>
          <p><strong>Επιχείρηση:</strong> ${esc(business)}</p>
          <p><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
          <p><strong>Τηλέφωνο:</strong> ${esc(phone) || "—"}</p>
          <p><strong>Υπηρεσίες:</strong> ${esc(serviceLine)}</p>
          <p><strong>Σημειώσεις:</strong> ${esc(notes) || "—"}</p>
          <p><strong>Αρχείο για τον αγοραστή:</strong> ${driveUrl ? `<a href="${esc(driveUrl)}">${esc(driveUrl)}</a>` : "—"}</p>
        </div>
      `,
    });

    if (error) {
      console.error("[myreels/api/lead] Resend error:", error);
      return res.status(502).json({
        ok: false,
        error: error.message || "Resend error",
      });
    }

    if (source === "reel" || source === "upsell") {
      const videoMatch = String(body.notes || "").match(/[?&]v=([\w-]{6,})/);
      const packNumber = Number(body.pack);
      try {
        const { recordPurchase } = await import("../lib/stay-board.mjs");
        await recordPurchase({
          property: business,
          buyerName: name,
          email,
          phone,
          videoId: String(body.videoId || videoMatch?.[1] || ""),
          pack: packNumber === 10 || services.includes("stay10") ? 10 : packNumber === 5 || services.includes("stay5") ? 5 : 0,
          net: reelNet,
        });
      } catch (boardErr) {
        console.error("[myreels/api/lead] board", boardErr?.message || boardErr);
      }
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("[myreels/api/lead] Send failed:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Send failed" });
  }
}
