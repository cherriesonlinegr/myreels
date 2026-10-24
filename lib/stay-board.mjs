import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mailboxConfig, withImap } from "./mailbox.mjs";

const FOLDER = "INBOX.MyReelsBoard";

function boardFile() {
  if (process.env.VERCEL) return "";
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    return path.join(root, "data", "stay-board.json");
  } catch {
    return "";
  }
}

export const STAY_STAGES = [
  { id: "landing", label: "Landing" },
  { id: "bought", label: "Αγόρασε το Reel" },
  { id: "pack5", label: "Πακέτο 5" },
  { id: "pack10", label: "Πακέτο 10" },
];

const RANK = { landing: 0, bought: 1, pack5: 2, pack10: 3 };

function euro(net, lang) {
  const amount = Number(net);
  if (!Number.isFinite(amount)) return "";
  const digits = Math.round(amount * 100) % 100 === 0 ? 0 : 2;
  return `${new Intl.NumberFormat(lang === "en" ? "en-GB" : "el-GR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(amount)}€`;
}

function sequenceSet(input, factory) {
  const sequences = factory();
  const source = input && typeof input === "object" ? input : null;
  for (const stage of STAY_STAGES) {
    if (Array.isArray(source?.[stage.id])) sequences[stage.id] = cleanEmail(source[stage.id]);
  }
  return sequences;
}

function cleanLine(value, fallback, max) {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
  return text || fallback;
}

function cleanMessages(input) {
  const base = defaultMessages();
  return {
    el: {
      viber: cleanLine(input?.el?.viber, base.el.viber, 2000),
      review: cleanLine(input?.el?.review, base.el.review, 800),
    },
    en: {
      viber: cleanLine(input?.en?.viber, base.en.viber, 2000),
      review: cleanLine(input?.en?.review, base.en.review, 800),
    },
  };
}

function sequencesFor(board, lang) {
  return lang === "en" ? board.sequencesEn : board.sequences;
}

function messageFor(board, lang) {
  const pack = lang === "en" ? board.messages?.en : board.messages?.el;
  const base = defaultMessages()[lang === "en" ? "en" : "el"];
  return {
    viber: pack?.viber || base.viber,
    review: pack?.review || base.review,
  };
}

function driveLink(deal) {
  const direct = String(deal?.driveUrl || "").trim();
  if (/^https:\/\/drive\.google\.com\//i.test(direct)) return direct.slice(0, 300);
  try {
    const id = new URL(String(deal?.landingUrl || "")).searchParams.get("g") || "";
    if (/^[\w-]{10,80}$/.test(id)) return `https://drive.google.com/file/d/${id}/view`;
  } catch {
    /* the landing has no drive file yet */
  }
  return "";
}

function fold(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function latinSlug(value) {
  let text = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  [
    ["ου", "ou"],
    ["αυ", "av"],
    ["ευ", "ev"],
    ["μπ", "b"],
    ["ντ", "nt"],
    ["γκ", "gk"],
    ["γγ", "ng"],
    ["τσ", "ts"],
    ["τζ", "tz"],
  ].forEach(([from, to]) => {
    text = text.replaceAll(from, to);
  });
  const letters = {
    α: "a",
    β: "b",
    γ: "g",
    δ: "d",
    ε: "e",
    ζ: "z",
    η: "i",
    θ: "th",
    ι: "i",
    κ: "k",
    λ: "l",
    μ: "m",
    ν: "n",
    ξ: "x",
    ο: "o",
    π: "p",
    ρ: "r",
    σ: "s",
    ς: "s",
    τ: "t",
    υ: "i",
    φ: "f",
    χ: "ch",
    ψ: "ps",
    ω: "o",
  };
  return [...text]
    .map((ch) => letters[ch] || ch)
    .join("")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function slugBase(value) {
  return latinSlug(value);
}

export function landingSlug(name, taken) {
  const base = slugBase(name);
  if (!base) return "";
  const used = new Set((Array.isArray(taken) ? taken : []).map((item) => String(item || "")));
  if (!used.has(base)) return base;
  let candidate = `${base}_gr`;
  let extra = 2;
  while (used.has(candidate)) {
    candidate = `${base}_gr${extra}`;
    extra += 1;
  }
  return candidate;
}

function assignSlugs(deals) {
  const used = [];
  const ordered = [...deals].sort((a, b) => Number(Boolean(slugBase(b.slug))) - Number(Boolean(slugBase(a.slug))));
  for (const deal of ordered) {
    const current = slugBase(deal.slug);
    const base = slugBase(deal.property);
    const suffix = current.startsWith(base) ? current.slice(base.length) : null;
    const family = suffix === "" || (suffix != null && /^_gr\d*$/.test(suffix));
    deal.slug = current && family && !used.includes(current) ? current : landingSlug(deal.property, used);
    used.push(deal.slug);
  }
}

export function defaultSequences() {
  return {
    landing: [
      {
        id: "landing-0",
        day: 0,
        active: true,
        subject: "Το Reel για το {property} είναι έτοιμο",
        body: "{hello},\n\nΤο Reel για το {property} είναι έτοιμο και παίζει στη σελίδα του.\n\nΑν σου κάθεται, το κλείνεις από εκεί. Το αρχείο στο στέλνουμε μόλις ολοκληρωθεί η παραγγελία.",
      },
      {
        id: "landing-2",
        day: 2,
        active: true,
        subject: "Το {property} σε περιμένει",
        body: "{hello},\n\nΤο Reel για το {property} είναι ακόμα στη σελίδα του, όποτε θέλεις το δεις.",
      },
    ],
    bought: [
      {
        id: "bought-0",
        day: 0,
        active: true,
        subject: "Το Reel για το {property}",
        body: "{hello},\n\nΑυτό είναι το Reel για το {property}.\n\nΚατέβασέ το από το link:\n{drive}\n\n{review}",
      },
      {
        id: "bought-5",
        day: 5,
        active: true,
        subject: "Αν πήγε καλά στα social",
        body: "{hello},\n\nΠέρασαν 5 μέρες από το Reel για το {property}.\n\nΑν πήγε καλά στα social, το επόμενο βήμα είναι 10 Reels συνολικά και να αναλάβουμε εμείς τα social για 2 μήνες. Γράφουμε τα posts και τα hashtags και τα προγραμματίζουμε σε Instagram, Facebook και TikTok, περίπου μία ανάρτηση κάθε 2–3 μέρες.\n\nΤα 10 είναι {pack10} χωρίς ΦΠΑ. Το πρώτο το έχεις ήδη, δεν το ξαναπληρώνεις. Απάντησε σε αυτό το email αν το θες.{review}",
      },
    ],
    pack5: [
      {
        id: "pack5-0",
        day: 0,
        active: true,
        subject: "Τα 5 Reels για το {property}",
        body: "{hello},\n\nΚράτησες 5 Reels για το {property}.\n\nΤο πρώτο είναι έτοιμο. Κατέβασέ το από το link:\n{drive}\n\nΤα άλλα τέσσερα τα φτιάχνουμε από τις φωτογραφίες που έχεις ήδη. Αυτό το πακέτο δεν περιλαμβάνει διαχείριση social.{review}",
      },
      {
        id: "pack5-10",
        day: 10,
        active: true,
        subject: "Αν πήγε καλά, τα 10 για το {property}",
        body: "{hello},\n\nΠέρασαν 10 μέρες από τα 5 Reels για το {property}.\n\nΑν πήγε καλά στα social, μπορείς να πας στα 10 Reels συνολικά και να αναλάβουμε εμείς τα social για 2 μήνες. Γράφουμε τα posts και τα hashtags και τα προγραμματίζουμε σε Instagram, Facebook και TikTok, περίπου μία ανάρτηση κάθε 2–3 μέρες.\n\nΤα 10 είναι {pack10} χωρίς ΦΠΑ. Τα 5 τα έχεις ήδη. Απάντησε σε αυτό το email αν θες να το δούμε.{review}",
      },
    ],
    pack10: [
      {
        id: "pack10-0",
        day: 0,
        active: true,
        subject: "Τα 10 Reels για το {property}",
        body: "{hello},\n\nΈχεις 10 Reels για το {property}, και πλήρη διαχείριση των social για 2 μήνες. Γράφουμε τα posts και τα hashtags και τα προγραμματίζουμε σε Instagram, Facebook και TikTok, περίπου μία ανάρτηση κάθε 2–3 μέρες. Δεν έχει ξεκινήσει ακόμα.\n\nΤο πρώτο Reel είναι έτοιμο. Κατέβασέ το από το link:\n{drive}{review}",
      },
    ],
  };
}

export function defaultSequencesEn() {
  return {
    landing: [
      {
        id: "landing-0",
        day: 0,
        active: true,
        subject: "The Reel for {property} is ready",
        body: "{hello},\n\nThe Reel for {property} is ready, and it's playing on its page.\n\nIf you want it, you buy it there. We send the file once the order is complete.",
      },
      {
        id: "landing-2",
        day: 2,
        active: true,
        subject: "{property} is still there",
        body: "{hello},\n\nThe Reel for {property} is still on its page, whenever you want to see it.",
      },
    ],
    bought: [
      {
        id: "bought-0",
        day: 0,
        active: true,
        subject: "The Reel for {property}",
        body: "{hello},\n\nThis is the Reel for {property}.\n\nDownload it here:\n{drive}\n\n{review}",
      },
      {
        id: "bought-5",
        day: 5,
        active: true,
        subject: "If it did well on social",
        body: "{hello},\n\nIt's been 5 days since the Reel for {property}.\n\nIf it did well on social, the next step is 10 Reels in total, and we run your socials for 2 months. We write the posts and the hashtags and schedule them on Instagram, Facebook and TikTok, about one post every 2–3 days.\n\nThe 10 are {pack10} excl. VAT. You already have the first one, so you don't pay for it again. Reply to this email if you want it.{review}",
      },
    ],
    pack5: [
      {
        id: "pack5-0",
        day: 0,
        active: true,
        subject: "The 5 Reels for {property}",
        body: "{hello},\n\nYou kept 5 Reels for {property}.\n\nThe first one is ready. Download it here:\n{drive}\n\nWe make the other four from the photos you already have. This pack does not include social management.{review}",
      },
      {
        id: "pack5-10",
        day: 10,
        active: true,
        subject: "If it did well, the 10 for {property}",
        body: "{hello},\n\nIt's been 10 days since the 5 Reels for {property}.\n\nIf it did well on social, you can move to 10 Reels in total, and we run your socials for 2 months. We write the posts and the hashtags and schedule them on Instagram, Facebook and TikTok, about one post every 2–3 days.\n\nThe 10 are {pack10} excl. VAT. You already have the 5. Reply to this email if you want to look at it.{review}",
      },
    ],
    pack10: [
      {
        id: "pack10-0",
        day: 0,
        active: true,
        subject: "The 10 Reels for {property}",
        body: "{hello},\n\nYou have 10 Reels for {property}, and full social management for 2 months. We write the posts and the hashtags and schedule them on Instagram, Facebook and TikTok, about one post every 2–3 days. It hasn't started yet.\n\nThe first Reel is ready. Download it here:\n{drive}{review}",
      },
    ],
  };
}

const REVIEW_LINE = {
  el: "Αν δεν μας έγραψες ακόμα δύο λόγια για την εμπειρία σου, θα μας βοηθούσε αφάνταστα αν αφιέρωνες μόλις 30 δευτερόλεπτα για να μας αφήσεις μια σύντομη αξιολόγηση.",
  en: "If you haven't told us how it went yet, it would help us a lot if you took 30 seconds to leave a short rating.",
};

const VIBER_LINE = {
  el: "{hello},\n\nΑν δεν μας έγραψες ακόμα δύο λόγια για την εμπειρία σου, θα μας βοηθούσε αφάνταστα αν αφιέρωνες μόλις 30 δευτερόλεπτα για να μας αφήσεις μια σύντομη αξιολόγηση.\n{link}",
  en: "{hello},\n\nIf you haven't told us how it went yet, it would help us a lot if you took 30 seconds to leave a short rating.\n{link}",
};

export function defaultMessages() {
  return {
    el: { viber: VIBER_LINE.el, review: REVIEW_LINE.el },
    en: { viber: VIBER_LINE.en, review: REVIEW_LINE.en },
  };
}

export const STAY_PERMS = ["pipeline", "landings", "oldway", "leads", "sequences", "reviews", "finance"];

function emptyBoard() {
  return { deals: [], sequences: defaultSequences(), reviews: [], payments: [], copy: "", users: [] };
}

function cleanEmail(list) {
  return (Array.isArray(list) ? list : []).slice(0, 8).map((item, index) => ({
    id: String(item?.id || `mail-${index}`).slice(0, 40),
    day: Math.max(0, Math.min(60, Number(item?.day) || 0)),
    active: item?.active !== false,
    subject: String(item?.subject || "").trim().slice(0, 180),
    body: String(item?.body || "").trim().slice(0, 4000),
  })).filter((item) => item.subject && item.body);
}

export function normalizeBoard(input) {
  const sequences = sequenceSet(input?.sequences, defaultSequences);
  const sequencesEn = sequenceSet(input?.sequencesEn, defaultSequencesEn);
  const messages = cleanMessages(input?.messages);
  const deals = (Array.isArray(input?.deals) ? input.deals : []).slice(0, 200).map((deal) => {
    const stage = deal.stage === "out" ? "out" : RANK[deal.stage] == null ? "landing" : deal.stage;
    let funnel = "";
    if (stage === "bought") {
      if (deal.funnel === "1" || deal.skipped === true) funnel = "1";
      else if (deal.funnel === "5") funnel = "5";
      else if (deal.funnel === "10") funnel = "10";
    }
    return {
      id: String(deal.id || ""),
      videoId: String(deal.videoId || ""),
      property: String(deal.property || "").trim().slice(0, 80),
      buyerName: String(deal.buyerName || "").trim().slice(0, 120),
      email: String(deal.email || "").trim().slice(0, 160),
      phone: String(deal.phone || "").trim().slice(0, 20),
      document: deal.document === "invoice" ? "invoice" : deal.document === "receipt" ? "receipt" : "",
      afm: /^\d{9}$/.test(deal.afm || "") ? deal.afm : "",
      companyName: String(deal.companyName || "").trim().slice(0, 200),
      companyTitle: String(deal.companyTitle || "").trim().slice(0, 120),
      companyAddress: String(deal.companyAddress || "").trim().slice(0, 300),
      stage,
      stageAt: deal.stageAt || deal.createdAt || new Date().toISOString(),
      createdAt: deal.createdAt || new Date().toISOString(),
      updatedAt: deal.updatedAt || new Date().toISOString(),
      net: Number(deal.net) || 0,
      pack5: Number(deal.pack5) || 0,
      pack10: Number(deal.pack10) || 0,
      landingUrl: String(deal.landingUrl || "").slice(0, 2000),
      driveUrl: driveLink(deal),
      slug: slugBase(deal.slug),
      lang: deal.lang === "en" ? "en" : "el",
      copy: String(deal.copy || "").slice(0, 20000),
      samples: cleanSamples(deal.samples),
      posterAt: posterSeconds(deal.posterAt),
      mobile: deal.mobile === "b" ? "b" : "a",
      sawTen: deal.sawTen === true,
      funnel,
      skipped: funnel === "1",
      reviewToken: /^[a-f0-9]{24}$/.test(deal.reviewToken) ? deal.reviewToken : "",
      reviewed: deal.reviewed === true,
      note: String(deal.note || "").trim().slice(0, 500),
      noteBy: String(deal.noteBy || "").trim().slice(0, 32),
      noteByName: String(deal.noteByName || "").trim().slice(0, 80),
      noteAt: /^\d{4}-\d{2}-\d{2}T/.test(deal.noteAt || "") ? deal.noteAt : "",
      uploadedBy: String(deal.uploadedBy || "").trim().slice(0, 80),
      uploadedAt: /^\d{4}-\d{2}-\d{2}T/.test(deal.uploadedAt || "") ? deal.uploadedAt : "",
      log: cleanLog(deal.log),
      archived: deal.archived === true,
      viberAt: (Array.isArray(deal.viberAt) ? deal.viberAt : [])
        .map((item) => String(item || ""))
        .filter((item) => /^\d{4}-\d{2}-\d{2}T/.test(item))
        .slice(-20),
      outreach: (Array.isArray(deal.outreach) ? deal.outreach : [])
        .map((item) => ({
          id: String(item?.id || "").trim().slice(0, 8),
          at: /^\d{4}-\d{2}-\d{2}T/.test(item?.at || "") ? item.at : "",
          via: [...new Set((Array.isArray(item?.via) ? item.via : []).map((channel) => String(channel || "")))]
            .filter((channel) => ["viber", "email", "whatsapp", "facebook", "instagram"].includes(channel)),
        }))
        .filter((item) => item.id && item.at)
        .slice(-30),
      drafts: cleanDrafts(deal.drafts),
      sent: deal.sent && typeof deal.sent === "object" ? deal.sent : {},
    };
  }).filter((deal) => deal.property || deal.videoId);
  assignSlugs(deals);
  const reviews = (Array.isArray(input?.reviews) ? input.reviews : [])
    .slice(0, 300)
    .map(cleanReview)
    .filter(Boolean);
  const payments = (Array.isArray(input?.payments) ? input.payments : [])
    .slice(0, 80)
    .map(cleanPayment)
    .filter(Boolean);
  return {
    deals,
    sequences,
    sequencesEn,
    messages,
    reviews,
    payments,
    copy: String(input?.copy || "").slice(0, 20000),
    users: cleanUsers(input?.users),
    leadSync: cleanLeadSync(input?.leadSync),
    costs: cleanCosts(input?.costs),
    outreachTexts: cleanOutreachTexts(input?.outreachTexts),
  };
}

function cleanCosts(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const id = String(item?.id || "").trim().slice(0, 24);
      const label = String(item?.label || "").trim().slice(0, 80);
      const amount = Math.round(Number(item?.amount ?? item?.net) * 100) / 100;
      const vat = item?.vat === true;
      const at = /^\d{4}-\d{2}-\d{2}/.test(item?.at || "") ? String(item.at).slice(0, 10) : "";
      if (!id || label.length < 2 || !(amount > 0) || amount > 1000000 || !at) return null;
      return { id, label, amount, vat, at, note: String(item?.note || "").trim().slice(0, 200) };
    })
    .filter(Boolean)
    .slice(0, 200);
}

function cleanLeadSync(input) {
  if (!input || typeof input !== "object") return null;
  const at = /^\d{4}-\d{2}-\d{2}T/.test(input.at || "") ? input.at : "";
  const leads = (Array.isArray(input.leads) ? input.leads : [])
    .slice(0, 400)
    .map((lead) => ({
      order: String(lead?.order || "").slice(0, 12),
      status: String(lead?.status || "").slice(0, 40),
      link: String(lead?.link || "").slice(0, 500),
      name: String(lead?.name || "").trim().slice(0, 120),
      region: String(lead?.region || "").slice(0, 80),
      email: String(lead?.email || "").slice(0, 160),
      phone: String(lead?.phone || "").slice(0, 40),
      social: String(lead?.social || "").slice(0, 500),
      channel: String(lead?.channel || "").slice(0, 40),
      contacted: String(lead?.contacted || "").slice(0, 40),
      replied: String(lead?.replied || "").slice(0, 40),
      notes: String(lead?.notes || "").slice(0, 8000),
      buyerName: String(lead?.buyerName || "").slice(0, 120),
      buyerPhone: String(lead?.buyerPhone || "").slice(0, 40),
      buyerEmail: String(lead?.buyerEmail || "").slice(0, 160),
    }))
    .filter((lead) => lead.name);
  if (!at && !leads.length) return null;
  return { at, canWrite: input.canWrite === true, leads };
}

function hashPass(pass) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pass), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function checkPass(pass, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !/^[a-f0-9]{64}$/.test(hash || "")) return false;
  const next = scryptSync(String(pass), salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function cleanUsers(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .slice(0, 30)
    .map((item) => {
      const user = String(item?.user || "");
      if (!/^[A-Za-z0-9_]{3,32}$/.test(user) || seen.has(user)) return null;
      if (user === "Thereelproject" || user.toLowerCase() === "nakis") return null;
      const passHash = String(item?.passHash || "");
      if (!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(passHash)) return null;
      seen.add(user);
      const permissions = {};
      for (const key of STAY_PERMS) permissions[key] = item?.permissions?.[key] === true;
      if (!Object.values(permissions).some(Boolean)) return null;
      return {
        id: String(item?.id || "").slice(0, 40) || `su_${user}`,
        name: String(item?.name || user).trim().slice(0, 80) || user,
        user,
        passHash,
        permissions,
      };
    })
    .filter(Boolean);
}

export function publicUsers(board) {
  return normalizeBoard(board).users.map(({ id, name, user, permissions }) => ({ id, name, user, permissions }));
}

export function loginStayUser(board, input) {
  const current = normalizeBoard(board);
  const user = String(input?.user || "");
  const pass = String(input?.pass || "");
  const found = current.users.find((item) => item.user === user);
  if (!found || !checkPass(pass, found.passHash)) return { ok: false };
  return { ok: true, name: found.name, permissions: found.permissions };
}

export function saveStayUser(board, input) {
  const current = normalizeBoard(board);
  const user = String(input?.account || "").trim();
  if (!/^[A-Za-z0-9_]{3,32}$/.test(user) || user === "Thereelproject" || user.toLowerCase() === "nakis") {
    return { board: current, ok: false, error: "Το username θέλει 3–32 λατινικούς χαρακτήρες." };
  }
  const permissions = {};
  for (const key of STAY_PERMS) permissions[key] = input?.permissions?.[key] === true || input?.permissions?.[key] === "true";
  if (!Object.values(permissions).some(Boolean)) {
    return { board: current, ok: false, error: "Διάλεξε τουλάχιστον ένα δικαίωμα." };
  }
  const id = String(input?.id || "").trim();
  const existing = current.users.find((item) => item.id === id);
  if (current.users.some((item) => item.user === user && item.id !== existing?.id)) {
    return { board: current, ok: false, error: "Αυτό το username υπάρχει ήδη." };
  }
  const pass = String(input?.password || "");
  let passHash = existing?.passHash || "";
  if (pass || !existing) {
    if (pass.length < 6 || pass.length > 80) {
      return { board: current, ok: false, error: "Ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες." };
    }
    passHash = hashPass(pass);
  }
  const next = {
    id: existing?.id || `su_${randomBytes(6).toString("hex")}`,
    name: String(input?.name || user).trim().slice(0, 80) || user,
    user,
    passHash,
    permissions,
  };
  if (existing) current.users[current.users.findIndex((item) => item.id === existing.id)] = next;
  else current.users.push(next);
  return { board: current, ok: true, users: publicUsers(current) };
}

export function removeStayUser(board, input) {
  const current = normalizeBoard(board);
  const id = String(input?.id || "").trim();
  const before = current.users.length;
  current.users = current.users.filter((item) => item.id !== id);
  if (current.users.length === before) return { board: current, ok: false, error: "Δεν βρέθηκε ο χρήστης." };
  return { board: current, ok: true, users: publicUsers(current) };
}

function cleanLog(list) {
  return (Array.isArray(list) ? list : [])
    .slice(-40)
    .map((item) => {
      const at = String(item?.at || "");
      const user = String(item?.user || "").trim().slice(0, 32);
      const kind = String(item?.kind || "").trim().slice(0, 24);
      if (!/^\d{4}-\d{2}-\d{2}T/.test(at) || !user || !kind) return null;
      return {
        at,
        user,
        name: String(item?.name || user).trim().slice(0, 80) || user,
        kind,
        text: String(item?.text || "").trim().slice(0, 160),
      };
    })
    .filter(Boolean);
}

function stamp(deal, input, kind, text) {
  const actor = input?.actor;
  const user = String(actor?.user || "").trim().slice(0, 32);
  if (!deal || !user) return;
  const name = String(actor?.name || user).trim().slice(0, 80) || user;
  const at = new Date().toISOString();
  deal.log = cleanLog([...(deal.log || []), { at, user, name, kind, text }]);
  if (kind === "note") {
    deal.noteBy = deal.note ? user : "";
    deal.noteByName = deal.note ? name : "";
    deal.noteAt = deal.note ? at : "";
  }
  if (kind === "upload" && !deal.uploadedBy) {
    deal.uploadedBy = name;
    deal.uploadedAt = at;
  }
}

function cleanSamples(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const samples = {};
  for (let index = 1; index <= 9; index += 1) {
    ["n", "v"].forEach((prefix) => {
      const key = `${prefix}${index}`;
      if (!Object.prototype.hasOwnProperty.call(source, key)) return;
      samples[key] = String(source[key] ?? "")
        .trim()
        .slice(0, prefix === "n" ? 80 : 200);
    });
  }
  return samples;
}

function posterSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(Math.min(n, 3600) * 10) / 10;
}

function grossCents(net) {
  const gross = Math.round(Number(net) * 1.24 * 100) / 100;
  return Math.round(gross * 100);
}

function amountMatches(reported, expectedCents) {
  const amount = Number(reported);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(expectedCents)) return false;
  if (Math.round(amount * 100) === expectedCents) return true;
  return Number.isInteger(amount) && amount === expectedCents;
}

function cleanPayment(item) {
  const kind = item?.kind === "reel" || item?.kind === "pack5" || item?.kind === "pack10" ? item.kind : "";
  const orderCode = String(item?.orderCode || "").replace(/\D/g, "").slice(0, 20);
  const id = String(item?.id || "").slice(0, 40);
  const amountCents = Math.round(Number(item?.amountCents) || 0);
  if (!kind || !/^mr_[a-f0-9]{16}$/.test(id) || !orderCode || amountCents < 30 || amountCents > 5000000) return null;
  const status = item?.status === "paid" || item?.status === "failed" ? item.status : "pending";
  return {
    id,
    orderCode,
    kind,
    videoId: String(item.videoId || "").slice(0, 20),
    property: String(item.property || "").trim().slice(0, 80),
    buyerName: String(item.buyerName || "").trim().slice(0, 120),
    email: String(item.email || "").trim().slice(0, 160),
    phone: String(item.phone || "").trim().slice(0, 20),
    document: item.document === "invoice" ? "invoice" : "receipt",
    afm: item.document === "invoice" && /^\d{9}$/.test(item.afm || "") ? item.afm : "",
    companyName: item.document === "invoice" ? String(item.companyName || "").trim().slice(0, 200) : "",
    companyTitle: item.document === "invoice" ? String(item.companyTitle || "").trim().slice(0, 120) : "",
    companyAddress: item.document === "invoice" ? String(item.companyAddress || "").trim().slice(0, 300) : "",
    net: Number(item.net) || 0,
    pack5: Number(item.pack5) || 0,
    pack10: Number(item.pack10) || 0,
    amountCents,
    status,
    transactionId: /^[0-9a-f-]{32,40}$/i.test(item.transactionId || "") ? String(item.transactionId) : "",
    createdAt: item.createdAt || new Date().toISOString(),
    paidAt: item.paidAt || "",
    notified: item.notified === true,
  };
}

export function savePublicCopy(board, copy) {
  const next = normalizeBoard(board);
  next.copy = String(copy || "").slice(0, 20000);
  return next;
}

function cleanReview(item) {
  const stars = Number(item?.stars);
  const message = String(item?.message || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 800);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  const status = item?.status === "approved" || item?.status === "rejected" ? item.status : "pending";
  return {
    id: String(item.id || "").slice(0, 40),
    dealId: String(item.dealId || "").slice(0, 80),
    property: String(item.property || "").trim().slice(0, 80),
    buyerName: String(item.buyerName || "").trim().slice(0, 120),
    email: String(item.email || "").trim().slice(0, 160),
    stars,
    message,
    hideName: item.hideName === true,
    status,
    createdAt: item.createdAt || new Date().toISOString(),
    publishedAt: status === "approved" && /^\d{4}-\d{2}-\d{2}T/.test(item.publishedAt || "") ? item.publishedAt : "",
  };
}

export function publicBuyerName(name, hide) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!hide || !clean) return clean;
  const parts = clean.split(" ");
  if (parts.length < 2) return clean;
  const initial = parts[parts.length - 1].charAt(0).toLocaleUpperCase("el-GR");
  return `${parts.slice(0, -1).join(" ")} ${initial}.`;
}

export function ensureReviewToken(deal) {
  if (/^[a-f0-9]{24}$/.test(deal?.reviewToken)) return deal.reviewToken;
  deal.reviewToken = randomBytes(12).toString("hex");
  return deal.reviewToken;
}

function reviewAsk(deal, line) {
  if (!deal || deal.stage === "landing" || deal.reviewed) return "";
  if (!/^[a-f0-9]{24}$/.test(deal.reviewToken || "")) return "";
  const origin = String(process.env.SITE_URL || "https://myreels.gr").replace(/\/$/, "");
  const sentence = String(line || REVIEW_LINE[deal.lang === "en" ? "en" : "el"]).trim();
  return `\n\n${sentence}\n${origin}/review?t=${deal.reviewToken}`;
}

function readFileBoard() {
  try {
    const file = boardFile();
    if (!file || !fs.existsSync(file)) return null;
    return normalizeBoard(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

function writeFileBoard(board) {
  if (process.env.VERCEL) return;
  const file = boardFile();
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(board));
}

async function ensureFolder(client) {
  try {
    const status = await client.status(FOLDER, { messages: true });
    if (status && typeof status.messages === "number") return;
  } catch (err) {
    const missing = err?.code === "NotFound" || /does not exist|doesn't exist/i.test(String(err?.message || ""));
    if (!missing) throw err;
  }
  await client.mailboxCreate(FOLDER);
}

async function loadImap(config) {
  return withImap(config, async (client) => {
    await ensureFolder(client);
    const lock = await client.getMailboxLock(FOLDER);
    try {
      const exists = client.mailbox?.exists || 0;
      if (!exists) return null;
      let latest = null;
      for await (const msg of client.fetch(`${Math.max(1, exists - 2)}:*`, { source: true, internalDate: true })) {
        latest = msg;
      }
      if (!latest?.source) return null;
      const text = latest.source.toString("utf8");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < start) return null;
      return normalizeBoard(JSON.parse(text.slice(start, end + 1)));
    } finally {
      lock.release();
    }
  });
}

async function saveImap(config, board) {
  const json = JSON.stringify(board);
  const raw = Buffer.from(
    `From: MyReels <${config.email}>\r\nTo: ${config.email}\r\nSubject: myreels-stay-board\r\nMIME-Version: 1.0\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}`,
    "utf8"
  );
  await withImap(config, async (client) => {
    await ensureFolder(client);
    const lock = await client.getMailboxLock(FOLDER);
    try {
      const uids = await client.search({ all: true }, { uid: true });
      await client.append(FOLDER, raw, ["\\Seen"]);
      if (Array.isArray(uids) && uids.length) {
        await client.messageDelete(uids, { uid: true });
      }
    } finally {
      lock.release();
    }
  });
}

export async function loadBoard() {
  const config = mailboxConfig();
  if (config) {
    try {
      const remote = await loadImap(config);
      if (remote) return remote;
    } catch (err) {
      console.error("[myreels/board] load", err?.message || err);
    }
  }
  return readFileBoard() || emptyBoard();
}

export async function saveBoard(board) {
  const next = normalizeBoard(board);
  const config = mailboxConfig();
  if (config) await saveImap(config, next);
  else writeFileBoard(next);
  return next;
}

function sameStay(deal, input) {
  if (input.videoId && deal.videoId && input.videoId === deal.videoId) return true;
  return fold(deal.property) && fold(deal.property) === fold(input.property);
}

function targetStage(pack) {
  if (Number(pack) === 10) return "pack10";
  if (Number(pack) === 5) return "pack5";
  return "bought";
}

export function planPurchase(board, input) {
  const next = normalizeBoard(board);
  const property = String(input.property || "").trim();
  const videoId = String(input.videoId || "").trim();
  let deal = next.deals.find((item) => sameStay(item, { property, videoId }));
  const stage = targetStage(input.pack);
  const now = new Date().toISOString();
  if (!deal) {
    deal = {
      id: `stay-${videoId || Date.now()}`,
      videoId,
      property,
      buyerName: "",
      email: "",
      phone: "",
      stage: "landing",
      stageAt: now,
      createdAt: now,
      updatedAt: now,
      net: Number(input.net) || 0,
      pack5: Number(input.pack5) || 0,
      pack10: Number(input.pack10) || 0,
      landingUrl: "",
      driveUrl: "",
      sent: {},
    };
    next.deals.unshift(deal);
  }
  const previous = deal.stage;
  const currentRank = deal.stage === "out" ? -1 : RANK[deal.stage];
  const moved = RANK[stage] > currentRank ? stage : deal.stage;
  if (moved !== previous) {
    deal.stage = moved;
    deal.stageAt = now;
    deal.archived = false;
  }
  if (deal.stage !== "bought") {
    deal.skipped = false;
    deal.funnel = "";
  }
  if (input.buyerName) deal.buyerName = String(input.buyerName).trim();
  if (input.email) deal.email = String(input.email).trim();
  if (input.phone) deal.phone = String(input.phone).trim().slice(0, 20);
  if (input.document === "invoice" || input.document === "receipt") {
    deal.document = input.document;
    deal.afm = input.document === "invoice" ? String(input.afm || "").replace(/\D/g, "").slice(0, 9) : "";
    deal.companyName = input.document === "invoice" ? String(input.companyName || "").trim().slice(0, 200) : "";
    deal.companyTitle = input.document === "invoice" ? String(input.companyTitle || "").trim().slice(0, 120) : "";
    deal.companyAddress = input.document === "invoice" ? String(input.companyAddress || "").trim().slice(0, 300) : "";
  }
  if (videoId && !deal.videoId) deal.videoId = videoId;
  if (property) deal.property = property;
  const linked = driveLink({ driveUrl: input.driveUrl, landingUrl: input.landingUrl || deal.landingUrl });
  if (linked) deal.driveUrl = linked;
  if (deal.stage !== "landing") ensureReviewToken(deal);
  deal.updatedAt = now;
  return { board: next, deal, changed: moved !== previous };
}

function payError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function quoteStayCheckout(board, input) {
  const next = normalizeBoard(board);
  const videoId = String(input?.videoId || "").trim();
  const property = String(input?.property || "").trim();
  const deal = next.deals.find((item) => sameStay(item, { videoId, property }));
  if (!deal || !(Number(deal.net) > 0)) throw payError("Αυτή η σελίδα δεν είναι έτοιμη για πληρωμή.");
  const kind = input?.kind === "pack"
    ? (Number(input.pack) === 10 ? "pack10" : Number(input.pack) === 5 ? "pack5" : "")
    : input?.kind === "reel"
      ? "reel"
      : "";
  if (!kind) throw payError("Αυτή η αναβάθμιση δεν είναι διαθέσιμη.");
  let amountCents = 0;
  let buyerName = "";
  let email = "";
  let phone = "";
  if (kind === "reel") {
    if (RANK[deal.stage] >= RANK.bought) throw payError("Αυτό το Reel έχει ήδη πληρωθεί.");
    amountCents = grossCents(deal.net);
    buyerName = String(input.buyerName || "").trim();
    email = String(input.email || "").trim();
    phone = String(input.phone || "").trim();
    if (input?.acceptPrivacy !== true) throw payError("Αποδέξου την Πολιτική Απορρήτου.");
    if (buyerName.length < 2) throw payError("Γράψε ονοματεπώνυμο.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw payError("Γράψε ένα email.");
    if (phone.replace(/\D/g, "").length < 10) throw payError("Γράψε ένα τηλέφωνο.");
  } else {
    if (deal.stage !== "bought") throw payError("Πλήρωσε πρώτα το πρώτο Reel.");
    const packNet = kind === "pack10" ? Number(deal.pack10) : Number(deal.pack5);
    amountCents = grossCents(packNet) - grossCents(deal.net);
    buyerName = deal.buyerName;
    email = deal.email;
    phone = deal.phone;
    if (!(amountCents >= 30)) throw payError("Αυτή η αναβάθμιση δεν είναι διαθέσιμη για αυτή την τιμή.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw payError("Λείπει το email της παραγγελίας.");
  }
  const fresh = next.payments.find((item) => {
    if (item.status !== "pending" || item.kind !== kind || item.videoId !== deal.videoId) return false;
    if (item.amountCents !== amountCents) return false;
    const age = Date.now() - new Date(item.createdAt).getTime();
    return age >= 0 && age < 25 * 60 * 1000;
  });
  return {
    reuse: fresh || null,
    deal,
    kind,
    amountCents,
    buyerName,
    email,
    phone,
  };
}

export async function rememberVivaOrder(payment) {
  const board = await loadBoard();
  board.payments = [payment, ...(board.payments || [])].slice(0, 80);
  return saveBoard(board);
}

export function vivaPaymentView(board, payment) {
  if (!payment) return null;
  return {
    status: payment.status,
    kind: payment.kind,
    property: payment.property,
    videoId: payment.videoId,
    buyerName: payment.buyerName,
    document: payment.document === "invoice" ? "invoice" : "receipt",
    afm: payment.document === "invoice" ? payment.afm || "" : "",
    net: payment.net,
    pack5: payment.pack5,
    pack10: payment.pack10,
  };
}

function purchaseLabel(stage) {
  if (stage === "pack10") return "Αγόρασε 10 Reels";
  if (stage === "pack5") return "Αγόρασε 5 Reels";
  return "Αγόρασε 1 Reel";
}

export async function noteLead(property, move, detail, deal) {
  try {
    const { logMovement } = await import("./lead-sheet.mjs");
    const result = await logMovement({
      property,
      move,
      detail,
      buyerName: deal?.buyerName || "",
      buyerPhone: deal?.phone || "",
      buyerEmail: deal?.email || "",
    });
    return result?.error || "";
  } catch (err) {
    console.error("[myreels/sheet]", err?.message || err);
    return err?.message || "Το Sheet δεν ενημερώθηκε.";
  }
}

export async function syncLeadSheet() {
  const { listLeads } = await import("./lead-sheet.mjs");
  const listed = await listLeads();
  const board = await loadBoard();
  board.leadSync = {
    at: new Date().toISOString(),
    canWrite: listed.canWrite === true,
    leads: listed.leads,
  };
  const saved = await saveBoard(board);
  return {
    leads: saved.leadSync?.leads || [],
    moves: listed.moves,
    canWrite: listed.canWrite === true,
    syncedAt: saved.leadSync?.at || "",
  };
}

export async function completeVivaOrder({ orderCode, transactionId, reportedAmount, merchantTrns }) {
  const board = await loadBoard();
  const payment = board.payments.find((item) => item.orderCode === String(orderCode || ""));
  if (!payment) return null;
  if (merchantTrns && merchantTrns !== payment.id) return { payment, rejected: true };
  if (!amountMatches(reportedAmount, payment.amountCents)) return { payment, rejected: true };
  if (payment.status === "paid") {
    const deal = board.deals.find((item) => sameStay(item, payment));
    return { payment, deal, already: true };
  }
  payment.status = "paid";
  payment.transactionId = transactionId;
  payment.paidAt = new Date().toISOString();
  const deal = board.deals.find((item) => sameStay(item, payment));
  const planned = planPurchase(board, {
    property: payment.property,
    videoId: payment.videoId,
    buyerName: payment.buyerName,
    email: payment.email,
    phone: payment.phone,
    document: payment.document,
    afm: payment.afm,
    companyName: payment.companyName,
    companyTitle: payment.companyTitle,
    companyAddress: payment.companyAddress,
    pack: payment.kind === "pack10" ? 10 : payment.kind === "pack5" ? 5 : 0,
    net: deal?.net || payment.net,
    pack5: deal?.pack5 || payment.pack5,
    pack10: deal?.pack10 || payment.pack10,
    driveUrl: deal?.driveUrl || "",
  });
  await sendDue(planned.board, { onlyDay: planned.changed ? 0 : null });
  const saved = await saveBoard(planned.board);
  if (planned.changed) await noteLead(planned.deal?.property, purchaseLabel(planned.deal?.stage), "", planned.deal);
  return {
    payment: saved.payments.find((item) => item.orderCode === payment.orderCode) || payment,
    deal: planned.deal,
    already: false,
  };
}

export async function failVivaOrder(orderCode) {
  const board = await loadBoard();
  const payment = board.payments.find((item) => item.orderCode === String(orderCode || ""));
  if (!payment || payment.status === "paid") return payment || null;
  payment.status = "failed";
  await saveBoard(board);
  return payment;
}

export async function markVivaNotified(orderCode) {
  const board = await loadBoard();
  const payment = board.payments.find((item) => item.orderCode === String(orderCode || ""));
  if (!payment || payment.notified) return;
  payment.notified = true;
  await saveBoard(board);
}

export function composeBody(body, deal, extras) {
  let text = String(body || "");
  const afterPurchase = deal?.stage && deal.stage !== "landing";
  if (afterPurchase && deal.reviewed) {
    text = text.replace(/[ \t]*\{review\}/g, "");
  } else if (afterPurchase) {
    ensureReviewToken(deal);
    if (!text.includes("{review}")) text += "\n{review}";
  }
  return fillTemplate(text, deal, extras).replace(/\n{3,}/g, "\n\n").trim();
}

export function fillTemplate(template, deal, extras) {
  const english = deal?.lang === "en";
  const hello = deal.buyerName
    ? english
      ? `Hello ${deal.buyerName}`
      : `Γεια σου ${deal.buyerName}`
    : english
      ? "Hello"
      : "Γεια σου";
  const map = {
    hello,
    name: deal.buyerName || "",
    property: deal.property || "",
    email: deal.email || "",
    phone: deal.phone || "",
    net: euro(deal.net, deal.lang),
    pack5: euro(deal.pack5, deal.lang),
    pack10: euro(deal.pack10, deal.lang),
    drive: driveLink(deal),
    review: reviewAsk(deal, extras?.review),
  };
  return String(template || "").replace(/\{(hello|name|property|email|phone|net|pack5|pack10|drive|review)\}/g, (_, key) => map[key] || "");
}

export async function sendTest({ to, subject, body, stage, lang, review }) {
  const recipient = String(to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Γράψε το email που θα λάβει τη δοκιμή.");
  }
  const english = lang === "en";
  const sample = {
    buyerName: english ? "Maria Georgiou" : "Μαρία Γεωργίου",
    property: "Ηλιοπετρόσπιτο",
    email: recipient,
    phone: "6900000000",
    net: 40,
    pack5: 170,
    pack10: 350,
    driveUrl: "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view",
    stage: RANK[stage] == null ? "bought" : stage,
    reviewToken: "0123456789abcdef01234567",
    reviewed: false,
    lang: english ? "en" : "el",
  };
  const preview = {
    subject: fillTemplate(subject, sample, { review }),
    text: composeBody(body, sample, { review }),
  };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, ...preview };
  }
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [recipient],
    subject: preview.subject,
    text: preview.text,
  });
  if (error) throw new Error(error.message || "Η δοκιμή δεν έφυγε.");
  return { sent: true, ...preview };
}

async function deliver(deal, email, extras) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !deal.email) return false;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [deal.email],
    subject: fillTemplate(email.subject, deal, extras),
    text: composeBody(email.body, deal, extras),
  });
  if (error) {
    console.error("[myreels/board] send", error.message || error);
    return false;
  }
  return true;
}

export async function sendDue(board, { onlyDay } = {}) {
  const now = Date.now();
  for (const deal of board.deals) {
    if (deal.archived || !deal.email) continue;
    const lang = deal.lang === "en" ? "en" : "el";
    const emails = (sequencesFor(board, lang)[deal.stage] || []);
    const extras = { review: messageFor(board, lang).review };
    const age = Math.floor((now - new Date(deal.stageAt).getTime()) / 86400000);
    for (const email of emails) {
      if (!email.active || deal.sent?.[email.id]) continue;
      if (onlyDay != null && email.day !== onlyDay) continue;
      if (onlyDay == null && email.day > age) continue;
      const ok = await deliver(deal, email, extras);
      if (ok) {
        deal.sent[email.id] = new Date().toISOString();
        await noteLead(deal.property, "Email", fillTemplate(email.subject, deal, extras), deal);
      }
    }
  }
  return board;
}

export function markUninterested(board, input) {
  const videoId = String(input?.videoId || "").trim();
  const current = normalizeBoard(board);
  const deal = current.deals.find((item) => item.videoId === videoId);
  if (!deal || deal.stage !== "landing") {
    return { board: current, ok: false, error: "Μετακινείται μόνο από το Landing." };
  }
  const now = new Date().toISOString();
  deal.stage = "out";
  deal.stageAt = now;
  deal.updatedAt = now;
  stamp(deal, input, "out", "Δεν ενδιαφέρεται");
  return { board: current, deal, ok: true, changed: true };
}

export function markViber(board, input) {
  const videoId = String(input?.videoId || "").trim();
  const current = normalizeBoard(board);
  const deal = current.deals.find((item) => item.videoId === videoId);
  if (!deal) return { board: current, ok: false, error: "Δεν βρέθηκε η σελίδα." };
  deal.viberAt = [...(deal.viberAt || []), new Date().toISOString()].slice(-20);
  deal.updatedAt = deal.viberAt[deal.viberAt.length - 1];
  stamp(deal, input, "viber", "Viber");
  return { board: current, deal, ok: true };
}

export function updateDeal(board, input) {
  const videoId = String(input?.videoId || "").trim();
  const current = normalizeBoard(board);
  const deal = current.deals.find((item) => item.videoId === videoId);
  if (!deal) return { board: current, ok: false, error: "Δεν βρέθηκε η σελίδα." };
  const prevNote = deal.note;
  const before = [deal.property, deal.buyerName, deal.email, deal.phone, deal.net, deal.pack5, deal.pack10, deal.driveUrl, deal.document, deal.afm, deal.companyName, deal.companyTitle, deal.companyAddress].join("\u0001");
  const property = String(input?.property ?? deal.property).trim().slice(0, 80);
  if (property.length < 2) return { board: current, ok: false, error: "Βάλε όνομα καταλύματος." };
  let driveUrl = deal.driveUrl;
  if (input?.driveUrl != null) {
    const raw = String(input.driveUrl || "").trim();
    if (!raw) driveUrl = "";
    else if (/^https:\/\/drive\.google\.com\//i.test(raw)) driveUrl = raw.slice(0, 300);
    else return { board: current, ok: false, error: "Το Drive θέλει σύνδεσμο του Google Drive." };
  }
  const money = (value, fallback) => {
    const amount = Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return fallback;
    return Math.round(amount * 100) / 100;
  };
  deal.property = property;
  deal.buyerName = String(input?.buyerName ?? "").trim().slice(0, 120);
  deal.email = String(input?.email ?? "").trim().slice(0, 160);
  deal.phone = String(input?.phone ?? "").trim().slice(0, 20);
  deal.net = money(input?.net, deal.net);
  deal.pack5 = money(input?.pack5, deal.pack5);
  deal.pack10 = money(input?.pack10, deal.pack10);
  deal.driveUrl = driveUrl;
  const document = input?.document === "invoice" || input?.document === "receipt" ? input.document : "";
  deal.document = document;
  deal.afm = document === "invoice" && /^\d{9}$/.test(String(input?.afm || "")) ? String(input.afm) : "";
  deal.companyName = document === "invoice" ? String(input?.companyName || "").trim().slice(0, 200) : "";
  deal.companyTitle = document === "invoice" ? String(input?.companyTitle || "").trim().slice(0, 120) : "";
  deal.companyAddress = document === "invoice" ? String(input?.companyAddress || "").trim().slice(0, 300) : "";
  deal.note = String(input?.note ?? deal.note).trim().slice(0, 500);
  deal.updatedAt = new Date().toISOString();
  if (deal.note !== prevNote) stamp(deal, input, "note", deal.note ? "Σημείωση" : "Έσβησε τη σημείωση");
  const after = [deal.property, deal.buyerName, deal.email, deal.phone, deal.net, deal.pack5, deal.pack10, deal.driveUrl, deal.document, deal.afm, deal.companyName, deal.companyTitle, deal.companyAddress].join("\u0001");
  if (after !== before) stamp(deal, input, "edit", "Αλλαγή στοιχείων");
  return { board: current, deal, ok: true };
}

const OUTREACH_LABELS = {
  sm1: "1ο μήνυμα",
  sm2: "Link landing",
  g1: "Follow-up 1, χωρίς απάντηση",
  g2: "Follow-up 2, χωρίς απάντηση",
  g3: "Follow-up 3, χωρίς απάντηση",
  w1: "Follow-up 1, είδε το link",
  w2: "Follow-up 2, είδε το link",
  w3: "Follow-up 3, είδε το link",
  n1: "Όχι, ευχαριστώ",
  n2: "Όχι, τα κάνουν μόνοι τους",
  n3: "Όχι, δεν έχουν budget",
};

const OUTREACH_CHANNELS = ["viber", "email", "whatsapp", "facebook", "instagram"];

function cleanOutreachTexts(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [id, text] of Object.entries(input)) {
    if (!OUTREACH_LABELS[id]) continue;
    const clean = String(text || "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
    if (clean) out[id] = clean;
  }
  return out;
}

export function saveOutreachTemplate(board, input) {
  const id = String(input?.id || "").trim();
  const current = normalizeBoard(board);
  if (!OUTREACH_LABELS[id]) return { board: current, ok: false, error: "Αυτό το μήνυμα δεν υπάρχει." };
  const text = String(input?.text || "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (text.length < 2) return { board: current, ok: false, error: "Το μήνυμα είναι άδειο." };
  current.outreachTexts = { ...cleanOutreachTexts(current.outreachTexts), [id]: text };
  for (const deal of current.deals) {
    if (deal.drafts?.[id]) delete deal.drafts[id];
  }
  return { board: current, ok: true };
}

function cleanDrafts(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [id, text] of Object.entries(input)) {
    if (!OUTREACH_LABELS[id]) continue;
    const clean = String(text || "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
    if (clean) out[id] = clean;
  }
  return out;
}

export function markOutreach(board, input) {
  const videoId = String(input?.videoId || "").trim();
  const id = String(input?.id || "").trim();
  const current = normalizeBoard(board);
  const deal = current.deals.find((item) => item.videoId === videoId);
  if (!deal) return { board: current, ok: false, error: "Δεν βρέθηκε η σελίδα." };
  if (!OUTREACH_LABELS[id]) return { board: current, ok: false, error: "Αυτό το μήνυμα δεν υπάρχει." };
  if (deal.stage !== "landing") return { board: current, ok: false, error: "Τα social μηνύματα είναι μόνο στο Landing." };
  const now = new Date().toISOString();
  if (typeof input.text === "string") {
    const text = input.text.replace(/\r\n/g, "\n").trim().slice(0, 2000);
    deal.drafts = cleanDrafts({ ...(deal.drafts || {}), [id]: text });
  }
  if (Array.isArray(input.channels)) {
    const via = [...new Set(input.channels.map((channel) => String(channel || "")))].filter((channel) => OUTREACH_CHANNELS.includes(channel));
    const rows = (deal.outreach || []).filter((item) => item.id !== id);
    if (via.length) rows.push({ id, at: now, via });
    deal.outreach = rows.slice(-30);
  }
  deal.updatedAt = now;
  return { board: current, deal, ok: true, label: OUTREACH_LABELS[id] };
}

export function saveCost(board, input) {
  const current = normalizeBoard(board);
  const label = String(input?.label || "").trim().slice(0, 80);
  const amount = Math.round(Number(String(input?.amount ?? input?.net ?? "").replace(",", ".")) * 100) / 100;
  const vat = input?.vat === true || input?.vat === "true" || input?.vat === "on";
  const at = String(input?.at || "").slice(0, 10);
  if (label.length < 2) return { board: current, ok: false, error: "Γράψε τι ήταν το κόστος." };
  if (!(amount > 0) || amount > 1000000) return { board: current, ok: false, error: "Γράψε ένα ποσό." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return { board: current, ok: false, error: "Διάλεξε ημερομηνία." };
  const id = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 24);
  current.costs = [{ id, label, amount, vat, at, note: String(input?.note || "").trim().slice(0, 200) }, ...(current.costs || [])].slice(0, 200);
  return { board: current, ok: true };
}

export function removeCost(board, input) {
  const current = normalizeBoard(board);
  const id = String(input?.id || "").trim();
  const next = (current.costs || []).filter((item) => item.id !== id);
  if (next.length === (current.costs || []).length) return { board: current, ok: false, error: "Το κόστος δεν βρέθηκε." };
  current.costs = next;
  return { board: current, ok: true };
}

export function setDealNote(board, input) {
  const videoId = String(input?.videoId || "").trim();
  const current = normalizeBoard(board);
  const deal = current.deals.find((item) => item.videoId === videoId);
  if (!deal) return { board: current, ok: false, error: "Δεν βρέθηκε η σελίδα." };
  const next = String(input?.note || "").trim().slice(0, 500);
  if (next === deal.note) return { board: current, deal, ok: true };
  deal.note = next;
  deal.updatedAt = new Date().toISOString();
  stamp(deal, input, "note", next ? "Σημείωση" : "Έσβησε τη σημείωση");
  return { board: current, deal, ok: true };
}

export function advanceLanding(board, input) {
  const stage = String(input?.stage || "");
  const pack = stage === "pack10" ? 10 : stage === "pack5" ? 5 : stage === "bought" ? 0 : null;
  if (pack == null) return { board: normalizeBoard(board), ok: false, error: "Αυτό το στάδιο δεν είναι διαθέσιμο." };
  const videoId = String(input?.videoId || "").trim();
  const current = normalizeBoard(board);
  const existing = current.deals.find((item) => item.videoId === videoId);
  if (!existing || existing.stage !== "landing") {
    return { board: current, ok: false, error: "Μετακινείται μόνο από το Landing, προς τα δεξιά." };
  }
  const planned = planPurchase(current, {
    property: existing.property,
    videoId: existing.videoId,
    buyerName: existing.buyerName,
    email: existing.email,
    phone: existing.phone,
    pack,
    net: existing.net,
    pack5: existing.pack5,
    pack10: existing.pack10,
    driveUrl: existing.driveUrl,
  });
  const moved = { bought: "Αγόρασε το Reel", pack5: "Πακέτο 5", pack10: "Πακέτο 10" }[stage] || stage;
  if (planned.changed && planned.deal) stamp(planned.deal, input, "move", moved);
  return { board: planned.board, deal: planned.deal, ok: true, changed: planned.changed };
}

export async function recordPurchase(input) {
  if (!input?.property && !input?.videoId) return null;
  const board = await loadBoard();
  const planned = planPurchase(board, input);
  await sendDue(planned.board, { onlyDay: planned.changed ? 0 : null });
  await saveBoard(planned.board);
  if (planned.changed) await noteLead(planned.deal?.property, purchaseLabel(planned.deal?.stage), "", planned.deal);
  return planned.deal;
}

export async function sendOne(board, stageId, emailId) {
  let count = 0;
  for (const deal of board.deals) {
    if (deal.stage !== stageId || deal.archived || !deal.email) continue;
    const lang = deal.lang === "en" ? "en" : "el";
    const email = (sequencesFor(board, lang)[stageId] || []).find((item) => item.id === emailId);
    if (!email || deal.sent?.[email.id]) continue;
    const extras = { review: messageFor(board, lang).review };
    const ok = await deliver(deal, email, extras);
    if (ok) {
      deal.sent[email.id] = new Date().toISOString();
      count += 1;
      await noteLead(deal.property, "Email", fillTemplate(email.subject, deal, extras), deal);
    }
  }
  return count;
}

export async function runDueSequences() {
  const board = await loadBoard();
  await sendDue(board);
  await saveBoard(board);
  return board.deals.length;
}

export function upsertLanding(board, input) {
  const next = normalizeBoard(board);
  const videoId = String(input.videoId || "").trim();
  const property = String(input.property || "").trim();
  if (!videoId || property.length < 2) return next;
  const now = new Date().toISOString();
  let deal = next.deals.find((item) => item.videoId === videoId);
  if (!deal) {
    deal = {
      id: `stay-${videoId}`,
      videoId,
      property,
      buyerName: "",
      email: "",
      phone: "",
      stage: "landing",
      stageAt: now,
      createdAt: input.createdAt || now,
      updatedAt: now,
      net: Number(input.net) || 0,
      pack5: Number(input.pack5) || 0,
      pack10: Number(input.pack10) || 0,
      landingUrl: String(input.landingUrl || ""),
      driveUrl: driveLink(input),
      slug: slugBase(input.slug),
      lang: input.lang === "en" ? "en" : "el",
      copy: typeof input.copy === "string" ? String(input.copy).slice(0, 20000) : "",
      samples: cleanSamples(input.samples),
      posterAt: posterSeconds(input.posterAt),
      sawTen: false,
      sent: {},
    };
    next.deals.unshift(deal);
    stamp(deal, input, "upload", "Ανέβασμα");
    return next;
  }
  deal.property = property;
  deal.net = Number(input.net) || deal.net;
  deal.pack5 = Number(input.pack5) || deal.pack5;
  deal.pack10 = Number(input.pack10) || deal.pack10;
  if (input.landingUrl) {
    let nextUrl = String(input.landingUrl);
    if (deal.lang === "en") nextUrl = nextUrl.replace("/luxurystayreels/", "/en/luxurystayreels/").replace("/en/en/", "/en/");
    else nextUrl = nextUrl.replace("/en/luxurystayreels/", "/luxurystayreels/");
    deal.landingUrl = nextUrl;
  }
  if (input.slug) deal.slug = slugBase(input.slug);
  if (typeof input.copy === "string") deal.copy = String(input.copy).slice(0, 20000);
  if (input.samples != null) deal.samples = cleanSamples(input.samples);
  if (input.posterAt != null) deal.posterAt = posterSeconds(input.posterAt);
  const linked = driveLink({ driveUrl: input.driveUrl || deal.driveUrl, landingUrl: deal.landingUrl });
  if (input.mobile === "a" || input.mobile === "b") deal.mobile = input.mobile;
  if (linked) deal.driveUrl = linked;
  deal.updatedAt = now;
  if (input.record === true) stamp(deal, input, "upload", "Ενημέρωση");
  return next;
}

const FUNNEL_RANK = { "": 0, "10": 1, "5": 2, "1": 3 };

export function markFunnel(board, input) {
  const next = normalizeBoard(board);
  const videoId = String(input.videoId || "").trim();
  const property = String(input.property || "").trim();
  const step = FUNNEL_RANK[input.step] ? String(input.step) : "";
  const deal = next.deals.find((item) => sameStay(item, { videoId, property }));
  if (!deal || deal.stage !== "bought" || !step) return { board: next, marked: false };
  let changed = false;
  if (step === "10" && !deal.sawTen) {
    deal.sawTen = true;
    changed = true;
  }
  if (FUNNEL_RANK[step] <= FUNNEL_RANK[deal.funnel || ""]) {
    if (!changed) return { board: next, marked: false };
    deal.updatedAt = new Date().toISOString();
    return { board: next, marked: true };
  }
  deal.funnel = step;
  deal.skipped = step === "1";
  deal.updatedAt = new Date().toISOString();
  return { board: next, marked: true };
}

export function markSkipped(board, input) {
  return markFunnel(board, { ...input, step: "1" });
}

function findReviewDeal(board, input) {
  const token = typeof input === "string" ? input : String(input?.token || "");
  if (/^[a-f0-9]{24}$/.test(token)) {
    return board.deals.find((item) => item.reviewToken === token && item.stage !== "landing") || null;
  }
  if (!input || typeof input !== "object") return null;
  const videoId = String(input.videoId || "").trim();
  const property = String(input.property || "").trim();
  if (!videoId && property.length < 2) return null;
  return board.deals.find((item) => sameStay(item, { videoId, property }) && item.stage !== "landing") || null;
}

export function reviewForm(board, input) {
  const deal = findReviewDeal(normalizeBoard(board), input);
  if (!deal) return null;
  return {
    property: deal.property,
    buyerName: deal.buyerName,
    reviewed: deal.reviewed === true,
    videoId: deal.videoId,
    lang: deal.lang === "en" ? "en" : "el",
  };
}

function decodeCopyBlob(raw) {
  if (!raw) return {};
  try {
    const b64 = String(raw).replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const data = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function encodeCopyBlob(data) {
  const diff = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) diff[key] = value;
  });
  if (!Object.keys(diff).length) return "";
  return Buffer.from(JSON.stringify(diff), "utf8").toString("base64url");
}

function publicCopy(boardCopy, dealCopy) {
  const shared = decodeCopyBlob(boardCopy);
  const own = decodeCopyBlob(dealCopy);
  const merged = { ...own };
  ["landing", "up10", "up5"].forEach((page) => {
    if (shared[page] && typeof shared[page] === "object") merged[page] = shared[page];
  });
  return encodeCopyBlob(merged);
}

export function publicLanding(board, slug) {
  const next = normalizeBoard(board);
  let key = String(slug || "");
  try {
    key = decodeURIComponent(key);
  } catch {
    /* the path is already plain text */
  }
  const folded = fold(slugBase(key));
  if (!folded) return null;
  const deal = next.deals.find((item) => fold(slugBase(item.slug)) === folded);
  if (!deal?.videoId) return null;
  return {
    property: deal.property,
    videoId: deal.videoId,
    net: deal.net,
    pack5: deal.pack5,
    pack10: deal.pack10,
    driveUrl: deal.driveUrl,
    copy: publicCopy(next.copy, deal.copy),
    samples: deal.samples || {},
    posterAt: deal.posterAt || 0,
    slug: deal.slug,
    lang: deal.lang === "en" ? "en" : "el",
    mobile: deal.mobile === "b" ? "b" : "a",
  };
}

export function submitReview(board, input) {
  const next = normalizeBoard(board);
  const deal = findReviewDeal(next, input);
  if (!deal) return { board: next, ok: false, error: "Αυτός ο σύνδεσμος δεν ανοίγει φόρμα." };
  if (deal.reviewed) return { board: next, ok: true, already: true };
  const stars = Number(input.stars);
  const message = String(input.message || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 800);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { board: next, ok: false, error: "Διάλεξε από 1 έως 5 αστέρια." };
  }
  const now = new Date().toISOString();
  next.reviews.unshift({
    id: `rev-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    dealId: deal.id,
    property: deal.property,
    buyerName: deal.buyerName,
    email: deal.email,
    stars,
    message,
    hideName: input.hideName === true,
    status: "pending",
    createdAt: now,
  });
  next.reviews = next.reviews.slice(0, 300);
  deal.reviewed = true;
  deal.updatedAt = now;
  return { board: next, ok: true };
}

export function moderateReview(board, input) {
  const next = normalizeBoard(board);
  const review = next.reviews.find((item) => item.id === String(input.id || ""));
  const status = input.status === "approved" || input.status === "rejected" ? input.status : "";
  if (!review || !status) return { board: next, ok: false };
  review.status = status;
  if (status === "approved") review.publishedAt = new Date().toISOString();
  return { board: next, ok: true };
}

export function publicReviews(board) {
  return normalizeBoard(board)
    .reviews.filter((item) => item.status === "approved")
    .sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)))
    .slice(0, 24)
    .map((item) => ({
      stars: item.stars,
      message: item.message,
      property: item.property,
      name: publicBuyerName(item.buyerName, item.hideName),
    }));
}

function videoIdsOf(input) {
  const list = Array.isArray(input?.videoIds) ? input.videoIds : [input?.videoId];
  return [...new Set(list.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 200);
}

export function setArchived(board, input) {
  const ids = new Set(videoIdsOf(input));
  const current = normalizeBoard(board);
  if (!ids.size) return { board: current, ok: false, error: "Δεν επιλέχθηκε σελίδα.", count: 0 };
  const archived = input?.archived !== false;
  const now = new Date().toISOString();
  let count = 0;
  for (const deal of current.deals) {
    if (!ids.has(deal.videoId) || deal.archived === archived) continue;
    deal.archived = archived;
    deal.updatedAt = now;
    stamp(deal, input, "archive", archived ? "Αρχειοθέτηση" : "Επαναφορά");
    count += 1;
  }
  if (!count) return { board: current, ok: false, error: "Δεν βρέθηκε η σελίδα.", count: 0 };
  return { board: current, ok: true, count };
}

export function removeDeals(board, input) {
  const ids = new Set(videoIdsOf(input));
  const current = normalizeBoard(board);
  if (!ids.size) return { board: current, ok: false, error: "Δεν επιλέχθηκε σελίδα.", count: 0 };
  const before = current.deals.length;
  current.deals = current.deals.filter((deal) => !ids.has(deal.videoId));
  const count = before - current.deals.length;
  if (!count) return { board: current, ok: false, error: "Δεν βρέθηκε η σελίδα.", count: 0 };
  return { board: current, ok: true, count };
}

export function removeLanding(board, videoId) {
  const next = normalizeBoard(board);
  next.deals = next.deals.filter((deal) => !(deal.videoId === videoId && deal.stage === "landing"));
  return next;
}
