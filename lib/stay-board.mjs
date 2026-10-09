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

function fold(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
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
        subject: "Πήραμε την παραγγελία για το {property}",
        body: "{hello},\n\nΠήραμε την παραγγελία για το {property}. Ετοιμάζουμε το τελικό αρχείο και στο στέλνουμε σε αυτό το email.\n\nΑν θέλεις κι άλλα, στην επόμενη σελίδα είναι τα 5 ({pack5} χωρίς ΦΠΑ) και τα 10 ({pack10} χωρίς ΦΠΑ). Τα προγραμματίζουμε εμείς σε Facebook, Instagram και TikTok.",
      },
      {
        id: "bought-2",
        day: 2,
        active: true,
        subject: "Τα επόμενα Reels για το {property}",
        body: "{hello},\n\nΤο πρώτο Reel για το {property} προχωράει.\n\nΤα 5 βγαίνουν {pack5} χωρίς ΦΠΑ και τα 10 βγαίνουν {pack10}. Όσο περισσότερα, τόσο χαμηλότερα το ένα.",
      },
    ],
    pack5: [
      {
        id: "pack5-0",
        day: 0,
        active: true,
        subject: "Τα 5 Reels για το {property}",
        body: "{hello},\n\nΚράτησες τα 5 για το {property}.\n\nΤα φτιάχνουμε και τα προγραμματίζουμε εμείς σε Facebook, Instagram και TikTok. Αν λείπει κάτι από τις φωτογραφίες, σου γράφουμε εδώ.",
      },
      {
        id: "pack5-3",
        day: 3,
        active: true,
        subject: "Τι μας βοηθάει για τα επόμενα",
        body: "{hello},\n\nΓια τα επόμενα Reels του {property} μας φτάνουν οι φωτογραφίες που έχεις ήδη online. Αν έχεις κάποια που θες οπωσδήποτε μέσα, στείλε την σε αυτό το email.",
      },
    ],
    pack10: [
      {
        id: "pack10-0",
        day: 0,
        active: true,
        subject: "Τα 10 Reels για το {property}",
        body: "{hello},\n\nΚράτησες τα 10 για το {property}. Είναι {pack10} χωρίς ΦΠΑ.\n\nΤα αναλαμβάνουμε εμείς, μαζί με τον προγραμματισμό σε Facebook, Instagram και TikTok.",
      },
      {
        id: "pack10-3",
        day: 3,
        active: true,
        subject: "Ξεκινάμε τα 10 για το {property}",
        body: "{hello},\n\nΜπαίνουμε στη σειρά για το {property}. Δεν χρειάζεται να στήσεις εσύ καμπάνια. Αν θέλεις να μπει οπωσδήποτε μια συγκεκριμένη φωτογραφία, στείλε την εδώ.",
      },
    ],
  };
}

function emptyBoard() {
  return { deals: [], sequences: defaultSequences() };
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
  const deals = (Array.isArray(input?.deals) ? input.deals : []).slice(0, 200).map((deal) => ({
    id: String(deal.id || ""),
    videoId: String(deal.videoId || ""),
    property: String(deal.property || "").trim().slice(0, 80),
    buyerName: String(deal.buyerName || "").trim().slice(0, 120),
    email: String(deal.email || "").trim().slice(0, 160),
    phone: String(deal.phone || "").trim().slice(0, 20),
    stage: RANK[deal.stage] == null ? "landing" : deal.stage,
    stageAt: deal.stageAt || deal.createdAt || new Date().toISOString(),
    createdAt: deal.createdAt || new Date().toISOString(),
    updatedAt: deal.updatedAt || new Date().toISOString(),
    net: Number(deal.net) || 0,
    pack5: Number(deal.pack5) || 0,
    pack10: Number(deal.pack10) || 0,
    landingUrl: String(deal.landingUrl || "").slice(0, 2000),
    sent: deal.sent && typeof deal.sent === "object" ? deal.sent : {},
  })).filter((deal) => deal.property || deal.videoId);
  return { deals, sequences };
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
  if (input.buyerName) deal.buyerName = String(input.buyerName).trim();
  if (input.email) deal.email = String(input.email).trim();
  if (input.phone) deal.phone = String(input.phone).trim().slice(0, 20);
  if (videoId && !deal.videoId) deal.videoId = videoId;
  if (property) deal.property = property;
  deal.updatedAt = now;
  return { board: next, deal, changed: moved !== previous };
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
  };
  return String(template || "").replace(/\{(hello|name|property|email|phone|net|pack5|pack10)\}/g, (_, key) => map[key] || "");
}

export async function sendTest({ to, subject, body }) {
  const recipient = String(to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Γράψε το email που θα λάβει τη δοκιμή.");
  }
  const preview = {
    subject: fillTemplate(subject, {
      buyerName: "Μαρία Γεωργίου",
      property: "Ηλιοπετρόσπιτο",
      email: recipient,
      phone: "6900000000",
      net: 40,
      pack5: 170,
      pack10: 300,
    }),
    text: "",
  };
  preview.text = fillTemplate(body, {
    buyerName: "Μαρία Γεωργίου",
    property: "Ηλιοπετρόσπιτο",
    email: recipient,
    phone: "6900000000",
    net: 40,
    pack5: 170,
    pack10: 300,
  });
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
    text: fillTemplate(email.body, deal),
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
  deal.updatedAt = now;
  return next;
}

export function removeLanding(board, videoId) {
  const next = normalizeBoard(board);
  next.deals = next.deals.filter((deal) => !(deal.videoId === videoId && deal.stage === "landing"));
  return next;
}
