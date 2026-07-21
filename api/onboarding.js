/**
 * MyReels client onboarding form → Resend email
 * Vercel project: myreels (myreels.gr ONLY)
 */
import { Resend } from "resend";

const SERVICE_LABELS = {
  content: "Social Media + Content",
  videos: "AI Avatar Videos",
  maps: "Google My Business",
};

const ACCESS_LABELS = {
  meta_partner: "Meta Business Suite / Partner access",
  admin_invite: "Admin / Editor invite",
  shared_login: "Shared login (να κανονιστεί με ασφάλεια)",
  later: "Θα κανονιστεί σε call",
};

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label, value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return `<p style="margin:0 0 10px"><strong>${esc(label)}:</strong><br/>${esc(v).replace(/\n/g, "<br/>")}</p>`;
}

function listRow(label, arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return row(label, arr.join(", "));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
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

  const b = req.body || {};
  const contactName = String(b.contactName || "").trim();
  const businessName = String(b.businessName || "").trim();
  const contactEmail = String(b.contactEmail || "").trim();
  const industry = String(b.industry || "").trim();
  const businessAbout = String(b.businessAbout || "").trim();
  const monthFocus = String(b.monthFocus || "").trim();
  const services = Array.isArray(b.services) ? b.services.map(String) : [];

  if (!contactName || !businessName || !contactEmail || !industry || !businessAbout || !monthFocus) {
    return res.status(400).json({
      ok: false,
      error: "Συμπλήρωσε τα υποχρεωτικά πεδία (όνομα, επιχείρηση, email, κλάδος, περιγραφή, focus μήνα).",
    });
  }

  const serviceLine = services.length
    ? services.map((id) => SERVICE_LABELS[id] || id).join(", ")
    : "Δεν επιλέχθηκε";

  const access = ACCESS_LABELS[b.accessMethod] || b.accessMethod || "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#1d1d1f;max-width:680px">
      <h2 style="margin:0 0 8px">Νέο Onboarding — MyReels</h2>
      <p style="margin:0 0 18px;color:#6e6e73">
        ${esc(businessName)} · ${esc(contactName)}
        ${b.leadId ? ` · lead: ${esc(b.leadId)}` : ""}
      </p>

      <h3 style="margin:20px 0 8px;font-size:16px">Επικοινωνία</h3>
      ${row("Όνομα", contactName)}
      ${row("Επιχείρηση", businessName)}
      ${row("Email", contactEmail)}
      ${row("Τηλέφωνο", b.contactPhone)}
      ${row("Εγκρίνει περιεχόμενο", b.approver)}
      ${row("Υπηρεσίες", serviceLine)}
      ${row("Έναρξη / deadline", b.startDate)}

      <h3 style="margin:20px 0 8px;font-size:16px">Επιχείρηση &amp; κοινό</h3>
      ${row("Κλάδος", industry)}
      ${row("Περιοχή", b.location)}
      ${row("Website", b.website)}
      ${row("Τι κάνουν", businessAbout)}
      ${row("Ιδανικός πελάτης", b.audience)}
      ${row("USP", b.usp)}
      ${row("Ανταγωνιστές / refs", b.competitors)}

      <h3 style="margin:20px 0 8px;font-size:16px">Brand</h3>
      ${listRow("Τόνος", b.tone)}
      ${row("Χρώματα", b.brandColors)}
      ${row("Γλώσσα", b.language)}
      ${row("Brand kit", b.brandKitUrl)}
      ${row("Taboo / αποφεύγουμε", b.taboo)}

      <h3 style="margin:20px 0 8px;font-size:16px">Social</h3>
      ${row("Instagram", b.ig)}
      ${row("Facebook", b.fb)}
      ${row("TikTok", b.tiktok)}
      ${row("Άλλο", b.otherSocial)}
      ${row("Πρόσβαση", access)}
      ${row("Τι έχει δουλέψει", b.whatWorks)}

      <h3 style="margin:20px 0 8px;font-size:16px">Scripts / θεματολόγιο</h3>
      ${row("Focus 1ου μήνα", monthFocus)}
      ${row("FAQs", b.faqs)}
      ${row("Offers / CTA", b.offers)}
      ${row("Must topics", b.mustTopics)}
      ${row("Avoid topics", b.avoidTopics)}
      ${row("Hashtags", b.hashtags)}
      ${row("Geo tags", b.geoTags)}

      <h3 style="margin:20px 0 8px;font-size:16px">Λήψεις / Avatar</h3>
      ${row("AI Avatar", b.needAvatar)}
      ${row("Assets URL", b.assetsUrl)}
      ${row("Εμφάνιση", b.appearance)}
      ${row("Διαθεσιμότητα λήψης", b.shootAvailability)}
      ${row("Χώρος γυρίσματος", b.shootLocation)}

      <h3 style="margin:20px 0 8px;font-size:16px">Google My Business</h3>
      ${row("GMB URL", b.gmbUrl)}
      ${row("Πρόσβαση", b.gmbAccess)}
      ${row("Κατηγορία", b.gmbCategory)}
      ${row("Ωράριο", b.gmbHours)}
      ${row("Υπηρεσίες / μενού", b.gmbServices)}

      <h3 style="margin:20px 0 8px;font-size:16px">Ροή</h3>
      ${row("Ταχύτητα έγκρισης", b.approvalSpeed)}
      ${row("Κανάλι επικοινωνίας", b.commChannel)}
      ${row("Επιπλέον σημειώσεις", b.extraNotes)}
    </div>
  `;

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: contactEmail,
      subject: `[MyReels Onboarding] ${businessName} — ${contactName}`,
      html,
    });

    if (error) {
      console.error("[myreels/api/onboarding] Resend error:", error);
      return res.status(502).json({ ok: false, error: error.message || "Resend error" });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("[myreels/api/onboarding] Send failed:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Send failed" });
  }
}
