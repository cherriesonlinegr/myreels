import Stripe from "stripe";
import { Resend } from "resend";

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function parseNet(value) {
  if (value == null || String(value).trim() === "") return null;
  const amount = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return null;
  return Math.round(amount * 100) / 100;
}

export function grossOf(net) {
  return Math.round(Number(net) * 1.24 * 100) / 100;
}

export function eurosToCents(amount) {
  return Math.round(Number(amount) * 100);
}

export function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function euroLabel(amount) {
  const cents = Math.round(Number(amount) * 100);
  const hasDecimals = cents % 100 !== 0;
  const formatted = new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
  return `${formatted}€`;
}

export function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

export function safeReturnPath(value, fallback) {
  const raw = String(value || "");
  const rest = raw.startsWith("/en/") ? raw.slice(3) : raw;
  if (!rest.startsWith("/reel") && !rest.startsWith("/upsell") && !rest.startsWith("/luxurystayreels/") && !rest.startsWith("/myairbnbreels/")) return fallback;
  if (raw.includes("://") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw.slice(0, 1800);
}

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(full) {
  const cleaned = cleanText(full, 80);
  if (!cleaned) return "";
  return cleaned.split(" ")[0];
}

export function buyerFileEmail({ buyerName, property, drive, lang }) {
  const english = lang === "en";
  const place = cleanText(property, 80) || (english ? "your property" : "το κατάλυμά σου");
  const name = firstName(buyerName);
  const fileUrl = esc(drive);
  const hello = name
    ? english
      ? `Hello ${esc(name)}.`
      : `Γεια σου ${esc(name)}.`
    : english
      ? "Your order is complete."
      : "Η παραγγελία σου ολοκληρώθηκε.";
  const subject = english ? `The Reel for ${place} is ready` : `Το Reel για το ${place} είναι έτοιμο`;
  const preheader = english
    ? `The file for ${esc(place)} is ready. Open it from Google Drive.`
    : `Το αρχείο για το ${esc(place)} είναι έτοιμο. Άνοιξέ το από το Google Drive.`;
  const kicker = english ? "Payment complete" : "Η πληρωμή ολοκληρώθηκε";
  const heading = english ? "The Reel is ready." : "Το Reel είναι έτοιμο.";
  const body = english
    ? `The file for <span style="color:#1d1d1f;font-weight:600;">${esc(place)}</span> is yours. This is the final file, not the preview you saw on the page.`
    : `Το αρχείο για το <span style="color:#1d1d1f;font-weight:600;">${esc(place)}</span> είναι δικό σου. Αυτό είναι το τελικό, όχι το preview που είδες στη σελίδα.`;
  const button = english ? "Open the file" : "Άνοιξε το αρχείο";
  const fallback = english ? "If the button does not open, use this link:" : "Αν το κουμπί δεν ανοίγει, πάτα αυτό το link:";
  const footer = english
    ? "MyReels · The Reel was made from the photos you already had online."
    : "MyReels · Το Reel φτιάχτηκε από τις φωτογραφίες που είχες ήδη online.";
  const owned = english
    ? `Payment is complete. The file for ${place} is yours.`
    : `Η πληρωμή ολοκληρώθηκε. Το αρχείο για το ${place} είναι δικό σου.`;
  const finalLine = english
    ? "This is the final file, not the preview on the page."
    : "Αυτό είναι το τελικό αρχείο, όχι το preview της σελίδας.";
  const text = [
    subject,
    "",
    hello,
    owned,
    finalLine,
    "",
    drive,
    "",
    "MyReels",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="${english ? "en" : "el"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;margin:0 auto;">
          <tr>
            <td style="padding:0 6px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f;">MyReels</td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:28px;padding:36px 32px 32px;">
              <p style="margin:0 0 12px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;font-weight:600;letter-spacing:-0.01em;color:#0071e3;">${kicker}</p>
              <h1 style="margin:0 0 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:34px;line-height:1.08;font-weight:600;letter-spacing:-0.035em;color:#1d1d1f;">${heading}</h1>
              <p style="margin:0 0 8px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:17px;line-height:1.45;color:#1d1d1f;">${hello}</p>
              <p style="margin:0 0 26px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:17px;line-height:1.45;color:#6e6e73;">${body}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="#0071e3" style="border-radius:980px;">
                    <a href="${fileUrl}" style="display:inline-block;padding:14px 22px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;text-decoration:none;">${button}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:#6e6e73;">${fallback}<br /><a href="${fileUrl}" style="color:#0071e3;word-break:break-all;">${fileUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 6px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.45;color:#6e6e73;">${footer}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

export function orderFromSession(session) {
  const meta = session.metadata || {};
  const gross = (Number(session.amount_total) || 0) / 100;
  const pack = Number(meta.pack);
  const kind = meta.kind === "pack" ? "pack" : "reel";
  return {
    id: session.id,
    created: session.created ? new Date(session.created * 1000).toISOString() : "",
    email: session.customer_details?.email || session.customer_email || meta.email || "",
    buyerName: meta.buyerName || session.customer_details?.name || "",
    phone: meta.phone || "",
    property: meta.property || "",
    kind,
    pack: pack === 5 || pack === 10 ? pack : null,
    videoId: meta.videoId || "",
    driveId: /^[\w-]{10,80}$/.test(meta.driveId || "") ? meta.driveId : "",
    net: meta.net || "",
    paidNet: meta.paidNet || "",
    extraNet: meta.extraNet || "",
    upgraded: meta.upgraded === "5" || meta.upgraded === "10" ? Number(meta.upgraded) : null,
    scheduling: meta.scheduling === "2m" || meta.scheduling === "40",
    pack5Net: meta.p5 || "",
    pack10Net: meta.p10 || "",
    amount: gross,
    lang: meta.lang === "en" ? "en" : "el",
    currency: session.currency || "eur",
    status: session.payment_status || "",
  };
}

export function productLabel(order) {
  if (order.kind === "pack" && order.pack === 10) return "10 Reels + διαχείριση social 2 μηνών";
  if (order.kind === "pack" && order.pack === 5) return "5 Reels";
  return "1 Reel";
}

async function markUpgrade(stripe, session) {
  const meta = session.metadata || {};
  if (meta.kind !== "pack" || (meta.pack !== "5" && meta.pack !== "10") || !meta.reelSession) return;
  try {
    const first = await stripe.checkout.sessions.retrieve(meta.reelSession);
    if (first.metadata?.upgraded === meta.pack) return;
    await stripe.checkout.sessions.update(meta.reelSession, {
      metadata: { ...(first.metadata || {}), upgraded: meta.pack },
    });
  } catch (err) {
    console.error("[myreels/payments] upgrade mark", err?.message || err);
  }
}

export async function notifyPaidOnce(stripe, session) {
  if (!session || session.payment_status !== "paid") return { emailed: false };
  await markUpgrade(stripe, session);
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!piId) return { emailed: false };

  const intent =
    session.payment_intent && typeof session.payment_intent === "object"
      ? session.payment_intent
      : await stripe.paymentIntents.retrieve(piId);
  if (intent.metadata?.notified === "1") return { emailed: false, already: true };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "MyReels <onboarding@resend.dev>";
  const adminTo = process.env.LEAD_NOTIFY_EMAIL;
  if (!apiKey) return { emailed: false };

  const order = orderFromSession(session);
  const sendFileToBuyer = order.kind === "reel" && Boolean(order.driveId) && Boolean(order.email);
  if (!adminTo && !sendFileToBuyer) return { emailed: false };

  const flags = intent.metadata || {};
  let buyerSent = flags.buyerNotified === "1" || !sendFileToBuyer;
  let adminSent = flags.adminNotified === "1" || !adminTo;
  if (buyerSent && adminSent) {
    if (flags.notified !== "1") {
      await stripe.paymentIntents.update(piId, { metadata: { notified: "1" } });
    }
    return { emailed: false, already: true };
  }

  const label = productLabel(order);
  const price = euroLabel(order.amount);
  const youtube = order.videoId ? `https://www.youtube.com/watch?v=${order.videoId}` : "";
  const drive = order.driveId ? `https://drive.google.com/file/d/${order.driveId}/view` : "";
  const resend = new Resend(apiKey);
  const fileMail = buyerFileEmail({
    buyerName: order.buyerName,
    property: order.property,
    drive,
    lang: order.lang,
  });

  if (!buyerSent) {
    const { error } = await resend.emails.send({
      from,
      to: [order.email],
      subject: fileMail.subject,
      text: fileMail.text,
      html: fileMail.html,
    });
    if (error) {
      console.error("[myreels/payments] Buyer email error:", error);
      return { emailed: false };
    }
    buyerSent = true;
  }

  if (!adminSent) {
    const { error } = await resend.emails.send({
      from,
      to: [adminTo],
      ...(order.email ? { replyTo: order.email } : {}),
      subject: `[MyReels Πληρωμή] ${order.buyerName || "Πελάτης"} — ${order.property || "κατάλυμα"} — ${price}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#1d1d1f">
          <h2 style="margin:0 0 12px">Πληρωμή MyReels</h2>
          <p><strong>Τι:</strong> ${esc(label)}</p>
          <p><strong>Ποσό:</strong> ${esc(price)}</p>
          <p><strong>Ονοματεπώνυμο:</strong> ${esc(order.buyerName) || "—"}</p>
          <p><strong>Τηλέφωνο:</strong> ${esc(order.phone) || "—"}</p>
          <p><strong>Κατάλυμα:</strong> ${esc(order.property) || "—"}</p>
          <p><strong>Email αγοραστή:</strong> ${esc(order.email) || "—"}</p>
          <p><strong>YouTube:</strong> ${youtube ? `<a href="${esc(youtube)}">${esc(youtube)}</a>` : "—"}</p>
          <p><strong>Αρχείο στον αγοραστή:</strong> ${drive ? `<a href="${esc(drive)}">${esc(drive)}</a>` : "—"}</p>
          <p><strong>Stripe:</strong> ${esc(session.id)}</p>
        </div>
      `,
    });
    if (error) {
      console.error("[myreels/payments] Admin email error:", error);
      await stripe.paymentIntents.update(piId, {
        metadata: {
          buyerNotified: buyerSent ? "1" : "",
          adminNotified: "",
          notified: "",
        },
      });
      return { emailed: false };
    }
    adminSent = true;
  }

  await stripe.paymentIntents.update(piId, {
    metadata: {
      buyerNotified: buyerSent ? "1" : "",
      adminNotified: adminSent ? "1" : "",
      notified: buyerSent && adminSent ? "1" : "",
    },
  });
  try {
    const { recordPurchase } = await import("./stay-board.mjs");
    await recordPurchase({
      property: order.property,
      buyerName: order.buyerName,
      email: order.email,
      phone: order.phone,
      videoId: order.videoId,
      pack: order.kind === "pack" ? order.pack : 0,
    });
  } catch (boardErr) {
    console.error("[myreels/payments] board", boardErr?.message || boardErr);
  }
  return { emailed: true };
}
