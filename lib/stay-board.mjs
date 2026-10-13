import { randomBytes } from "node:crypto";
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

function euro(net) {
  const amount = Number(net);
  if (!Number.isFinite(amount)) return "";
  const digits = Math.round(amount * 100) % 100 === 0 ? 0 : 2;
  return `${new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(amount)}€`;
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

function emptyBoard() {
  return { deals: [], sequences: defaultSequences(), reviews: [], payments: [], copy: "" };
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
  const sequences = defaultSequences();
  for (const stage of STAY_STAGES) {
    if (Array.isArray(input?.sequences?.[stage.id])) {
      sequences[stage.id] = cleanEmail(input.sequences[stage.id]);
    }
  }
  const deals = (Array.isArray(input?.deals) ? input.deals : []).slice(0, 200).map((deal) => {
    const stage = RANK[deal.stage] == null ? "landing" : deal.stage;
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
      copy: String(deal.copy || "").slice(0, 20000),
      samples: cleanSamples(deal.samples),
      posterAt: posterSeconds(deal.posterAt),
      sawTen: deal.sawTen === true,
      funnel,
      skipped: funnel === "1",
      reviewToken: /^[a-f0-9]{24}$/.test(deal.reviewToken) ? deal.reviewToken : "",
      reviewed: deal.reviewed === true,
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
  return { deals, sequences, reviews, payments, copy: String(input?.copy || "").slice(0, 20000) };
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

function reviewAsk(deal) {
  if (!deal || deal.stage === "landing" || deal.reviewed) return "";
  if (!/^[a-f0-9]{24}$/.test(deal.reviewToken || "")) return "";
  const origin = String(process.env.SITE_URL || "https://myreels.gr").replace(/\/$/, "");
  return `\n\nΑν σου άρεσε, γράψε μας δυο λόγια. Το όνομά σου και το κατάλυμα είναι ήδη μέσα:\n${origin}/review?t=${deal.reviewToken}`;
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
  const moved = RANK[stage] > RANK[deal.stage] ? stage : deal.stage;
  if (moved !== previous) {
    deal.stage = moved;
    deal.stageAt = now;
  }
  if (deal.stage !== "bought") {
    deal.skipped = false;
    deal.funnel = "";
  }
  if (input.buyerName) deal.buyerName = String(input.buyerName).trim();
  if (input.email) deal.email = String(input.email).trim();
  if (input.phone) deal.phone = String(input.phone).trim().slice(0, 20);
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
    net: payment.net,
    pack5: payment.pack5,
    pack10: payment.pack10,
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
    pack: payment.kind === "pack10" ? 10 : payment.kind === "pack5" ? 5 : 0,
    net: deal?.net || payment.net,
    pack5: deal?.pack5 || payment.pack5,
    pack10: deal?.pack10 || payment.pack10,
    driveUrl: deal?.driveUrl || "",
  });
  await sendDue(planned.board, { onlyDay: planned.changed ? 0 : null });
  const saved = await saveBoard(planned.board);
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

export function composeBody(body, deal) {
  let text = String(body || "");
  const afterPurchase = deal?.stage && deal.stage !== "landing";
  if (afterPurchase && deal.reviewed) {
    text = text.replace(/[ \t]*\{review\}/g, "");
  } else if (afterPurchase) {
    ensureReviewToken(deal);
    if (!text.includes("{review}")) text += "\n{review}";
  }
  return fillTemplate(text, deal).replace(/\n{3,}/g, "\n\n").trim();
}

export function fillTemplate(template, deal) {
  const hello = deal.buyerName ? `Γεια σου ${deal.buyerName}` : "Γεια σου";
  const map = {
    hello,
    name: deal.buyerName || "",
    property: deal.property || "",
    email: deal.email || "",
    phone: deal.phone || "",
    net: euro(deal.net),
    pack5: euro(deal.pack5),
    pack10: euro(deal.pack10),
    drive: driveLink(deal),
    review: reviewAsk(deal),
  };
  return String(template || "").replace(/\{(hello|name|property|email|phone|net|pack5|pack10|drive|review)\}/g, (_, key) => map[key] || "");
}

export async function sendTest({ to, subject, body, stage }) {
  const recipient = String(to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Γράψε το email που θα λάβει τη δοκιμή.");
  }
  const sample = {
    buyerName: "Μαρία Γεωργίου",
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
  };
  const preview = {
    subject: fillTemplate(subject, sample),
    text: composeBody(body, sample),
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

async function deliver(deal, email) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !deal.email) return false;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [deal.email],
    subject: fillTemplate(email.subject, deal),
    text: composeBody(email.body, deal),
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
    if (!deal.email) continue;
    const emails = board.sequences[deal.stage] || [];
    const age = Math.floor((now - new Date(deal.stageAt).getTime()) / 86400000);
    for (const email of emails) {
      if (!email.active || deal.sent?.[email.id]) continue;
      if (onlyDay != null && email.day !== onlyDay) continue;
      if (onlyDay == null && email.day > age) continue;
      const ok = await deliver(deal, email);
      if (ok) deal.sent[email.id] = new Date().toISOString();
    }
  }
  return board;
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
  return { board: planned.board, deal: planned.deal, ok: true, changed: planned.changed };
}

export async function recordPurchase(input) {
  if (!input?.property && !input?.videoId) return null;
  const board = await loadBoard();
  const planned = planPurchase(board, input);
  await sendDue(planned.board, { onlyDay: planned.changed ? 0 : null });
  await saveBoard(planned.board);
  return planned.deal;
}

export async function sendOne(board, stageId, emailId) {
  const email = (board.sequences[stageId] || []).find((item) => item.id === emailId);
  if (!email) return 0;
  let count = 0;
  for (const deal of board.deals) {
    if (deal.stage !== stageId || !deal.email || deal.sent?.[email.id]) continue;
    const ok = await deliver(deal, email);
    if (ok) {
      deal.sent[email.id] = new Date().toISOString();
      count += 1;
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
      copy: typeof input.copy === "string" ? String(input.copy).slice(0, 20000) : "",
      samples: cleanSamples(input.samples),
      posterAt: posterSeconds(input.posterAt),
      sawTen: false,
      sent: {},
    };
    next.deals.unshift(deal);
    return next;
  }
  deal.property = property;
  deal.net = Number(input.net) || deal.net;
  deal.pack5 = Number(input.pack5) || deal.pack5;
  deal.pack10 = Number(input.pack10) || deal.pack10;
  if (input.landingUrl) deal.landingUrl = String(input.landingUrl);
  if (input.slug) deal.slug = slugBase(input.slug);
  if (typeof input.copy === "string") deal.copy = String(input.copy).slice(0, 20000);
  if (input.samples != null) deal.samples = cleanSamples(input.samples);
  if (input.posterAt != null) deal.posterAt = posterSeconds(input.posterAt);
  const linked = driveLink({ driveUrl: input.driveUrl || deal.driveUrl, landingUrl: deal.landingUrl });
  if (linked) deal.driveUrl = linked;
  deal.updatedAt = now;
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
  };
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
    copy: deal.copy || "",
    samples: deal.samples || {},
    posterAt: deal.posterAt || 0,
    slug: deal.slug,
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
  return { board: next, ok: true };
}

export function publicReviews(board) {
  return normalizeBoard(board)
    .reviews.filter((item) => item.status === "approved")
    .slice(0, 24)
    .map((item) => ({
      stars: item.stars,
      message: item.message,
      property: item.property,
      name: publicBuyerName(item.buyerName, item.hideName),
    }));
}

export function removeLanding(board, videoId) {
  const next = normalizeBoard(board);
  next.deals = next.deals.filter((deal) => !(deal.videoId === videoId && deal.stage === "landing"));
  return next;
}
