import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAILBOX_EMAIL = "contact@myreels.gr";

function loadEnvFile() {
  if (process.env.VERCEL) return;
  let root;
  try {
    root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  } catch {
    return;
  }
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

function mailboxConfig() {
  const email = (process.env.MAILBOX_EMAIL || MAILBOX_EMAIL).trim();
  const password = process.env.MAILBOX_PASSWORD || "";
  if (!password) return null;
  const smtpPort = Number(process.env.MAILBOX_SMTP_PORT || 587);
  return {
    email,
    password,
    imapHost: process.env.MAILBOX_IMAP_HOST?.trim() || "imap.dreamhost.com",
    imapPort: Number(process.env.MAILBOX_IMAP_PORT || 993),
    smtpHost: process.env.MAILBOX_SMTP_HOST?.trim() || "smtp.dreamhost.com",
    smtpPort,
    smtpSecure: process.env.MAILBOX_SMTP_SECURE === "true" || smtpPort === 465,
  };
}

const SPECIAL_LABELS = {
  "\\Inbox": "Εισερχόμενα",
  "\\Sent": "Εξερχόμενα",
  "\\Drafts": "Πρόχειρα",
  "\\Trash": "Απορρίμματα",
  "\\Junk": "Spam",
  "\\Archive": "Αρχειοθετημένα",
};

function folderLabel(folderPath, specialUse, name) {
  if (specialUse && SPECIAL_LABELS[specialUse]) return SPECIAL_LABELS[specialUse];
  const lower = `${folderPath} ${name || ""}`.toLowerCase();
  if (folderPath.toUpperCase() === "INBOX" || lower.includes("inbox")) return "Εισερχόμενα";
  if (lower.includes("sent")) return "Εξερχόμενα";
  if (lower.includes("draft")) return "Πρόχειρα";
  if (lower.includes("trash") || lower.includes("deleted")) return "Απορρίμματα";
  if (lower.includes("junk") || lower.includes("spam")) return "Spam";
  if (lower.includes("archive")) return "Αρχειοθετημένα";
  return (name || folderPath || "").trim();
}

function folderRank(folder) {
  const order = ["Εισερχόμενα", "Εξερχόμενα", "Πρόχειρα", "Spam", "Απορρίμματα", "Αρχειοθετημένα"];
  const index = order.indexOf(folder.label);
  return index === -1 ? order.length : index;
}

function snippetOf(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function sanitizeHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function people(list) {
  return (list || [])
    .map((item) => item?.address || item?.name || "")
    .filter(Boolean)
    .join(", ");
}

function summarize(uid, envelope, flags, date, parsed, email) {
  const from = parsed?.from?.value?.[0] || envelope?.from?.[0] || {};
  const to = parsed?.to?.text || people(envelope?.to);
  const fromAddress = from.address || "";
  const outbound = fromAddress.toLowerCase() === email.toLowerCase();
  return {
    id: String(uid),
    fromAddress,
    fromName: from.name || null,
    toAddresses: to,
    subject: parsed?.subject || envelope?.subject || "(χωρίς θέμα)",
    snippet: snippetOf(parsed?.text || ""),
    receivedAt: (parsed?.date || date || new Date()).toISOString(),
    isRead: Boolean(flags?.has?.("\\Seen") || flags?.has?.("\\seen")),
    direction: outbound ? "outbound" : "inbound",
  };
}

async function withImap(config, run) {
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: { user: config.email, pass: config.password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

async function listFolders(config) {
  return withImap(config, async (client) => {
    const boxes = await client.list();
    const folders = [];
    for (const box of boxes) {
      const flags = box.flags || new Set();
      if (flags.has("\\Noselect")) continue;
      let total = 0;
      let unseen = 0;
      try {
        const status = await client.status(box.path, { messages: true, unseen: true });
        total = status.messages || 0;
        unseen = status.unseen || 0;
      } catch {
        total = 0;
      }
      const specialUse = box.specialUse || null;
      folders.push({
        path: box.path,
        name: box.name,
        label: folderLabel(box.path, specialUse, box.name),
        specialUse,
        total,
        unseen,
      });
    }
    folders.sort((a, b) => folderRank(a) - folderRank(b) || a.label.localeCompare(b.label, "el"));
    return folders;
  });
}

async function listMessages(config, folder, limit) {
  const count = Math.min(Math.max(Number(limit) || 40, 1), 50);
  return withImap(config, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const exists = client.mailbox?.exists || 0;
      if (!exists) return [];
      const start = Math.max(1, exists - count + 1);
      const messages = [];
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: { start: 0, maxLength: 8000 },
      })) {
        let parsed = null;
        if (msg.source) {
          try {
            const { simpleParser } = await import("mailparser");
            parsed = await simpleParser(msg.source);
          } catch {
            parsed = null;
          }
        }
        messages.push(summarize(msg.uid, msg.envelope, msg.flags, msg.internalDate, parsed, config.email));
      }
      messages.reverse();
      return messages;
    } finally {
      lock.release();
    }
  });
}

async function readMessage(config, folder, uid) {
  return withImap(config, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, envelope: true, flags: true, internalDate: true, source: true },
        { uid: true }
      );
      if (!msg) return null;
      const { simpleParser } = await import("mailparser");
      const parsed = msg.source ? await simpleParser(msg.source) : null;
      const summary = summarize(msg.uid, msg.envelope, msg.flags, msg.internalDate, parsed, config.email);
      await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true }).catch(() => {});
      return {
        ...summary,
        isRead: true,
        bodyText: parsed?.text || "",
        bodyHtml: sanitizeHtml(parsed?.html || ""),
        messageId: parsed?.messageId || null,
      };
    } finally {
      lock.release();
    }
  });
}

async function sendMessage(config, input) {
  const to = String(input.to || "").trim();
  const subject = String(input.subject || "").trim();
  const text = String(input.text || "").trim();
  if (!to || !subject || !text) {
    const error = new Error("Συμπλήρωσε παραλήπτη, θέμα και κείμενο.");
    error.status = 400;
    throw error;
  }
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.email, pass: config.password },
  });
  await transporter.sendMail({
    from: `MyReels <${config.email}>`,
    to,
    subject,
    text,
    inReplyTo: input.inReplyTo || undefined,
    references: input.inReplyTo || undefined,
  });
  return { ok: true };
}

function authError(body) {
  const expectedUser = process.env.ADMIN_USER || "";
  const expectedPass = process.env.ADMIN_PASS || "";
  if (!expectedUser || !expectedPass) {
    return "Βάλε ADMIN_USER και ADMIN_PASS στο περιβάλλον, ίδια με την είσοδο του admin.";
  }
  if (String(body.user || "") !== expectedUser || String(body.pass || "") !== expectedPass) {
    return "Δεν έχεις πρόσβαση στο ταχυδρομείο.";
  }
  return "";
}

function publicError(err) {
  const message = String(err?.message || "");
  if (/auth|invalid credentials|login/i.test(message)) {
    return "Το contact@myreels.gr δεν συνδέθηκε. Έλεγξε τον κωδικό του mailbox.";
  }
  if (err?.status === 400) return message;
  return "Το ταχυδρομείο δεν απάντησε. Δοκίμασε ξανά.";
}

export async function handleMail(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const denied = authError(body);
  if (denied) {
    const status = denied.startsWith("Δεν έχεις") ? 401 : 500;
    return res.status(status).json({ ok: false, error: denied });
  }

  const config = mailboxConfig();
  if (!config) {
    return res.status(200).json({
      ok: true,
      configured: false,
      email: MAILBOX_EMAIL,
    });
  }

  const action = String(body.action || "status");
  try {
    if (action === "status") {
      return res.status(200).json({ ok: true, configured: true, email: config.email });
    }
    if (action === "folders") {
      const folders = await listFolders(config);
      return res.status(200).json({ ok: true, configured: true, email: config.email, folders });
    }
    if (action === "messages") {
      const folder = String(body.folder || "INBOX");
      const messages = await listMessages(config, folder, body.limit);
      return res.status(200).json({ ok: true, messages });
    }
    if (action === "read") {
      const message = await readMessage(config, String(body.folder || "INBOX"), body.uid);
      if (!message) return res.status(404).json({ ok: false, error: "Το μήνυμα δεν βρέθηκε." });
      return res.status(200).json({ ok: true, message });
    }
    if (action === "send") {
      await sendMessage(config, body);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: "Άγνωστη ενέργεια." });
  } catch (err) {
    console.error("[myreels/mail]", err?.message || err);
    return res.status(502).json({ ok: false, error: publicError(err) });
  }
}
