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
  const password = String(process.env.MAILBOX_PASSWORD || "").trim();
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

function folderLeaf(folderPath, name) {
  return String(name || folderPath || "")
    .split(/[./\\]/)
    .filter(Boolean)
    .pop()
    ?.toLowerCase() || "";
}

function folderLabel(folderPath, specialUse, name) {
  if (specialUse && SPECIAL_LABELS[specialUse]) return SPECIAL_LABELS[specialUse];
  const leaf = folderLeaf(folderPath, name);
  if (String(folderPath || "").toUpperCase() === "INBOX" || leaf === "inbox") return "Εισερχόμενα";
  if (leaf.includes("sent")) return "Εξερχόμενα";
  if (leaf.includes("draft")) return "Πρόχειρα";
  if (leaf.includes("trash") || leaf.includes("deleted") || leaf.includes("bin")) return "Απορρίμματα";
  if (leaf.includes("junk") || leaf.includes("spam")) return "Spam";
  if (leaf.includes("archive")) return "Αρχειοθετημένα";
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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    tls: { servername: config.imapHost, rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

const KNOWN_FOLDERS = [
  "INBOX",
  "INBOX.Sent",
  "INBOX.Drafts",
  "INBOX.Trash",
  "INBOX.Junk",
  "INBOX.Spam",
  "Sent",
  "Drafts",
  "Trash",
  "Junk",
  "Spam",
];

function boxesToFolders(boxes) {
  const folders = [];
  for (const box of boxes) {
    const flags = box.flags;
    const noselect = flags && typeof flags.has === "function" && flags.has("\\Noselect");
    const inbox = String(box.path || "").toUpperCase() === "INBOX" || box.specialUse === "\\Inbox";
    if (noselect && !inbox) continue;
    const specialUse = box.specialUse || null;
    folders.push({
      path: box.path,
      name: box.name,
      label: folderLabel(box.path, specialUse, box.name),
      specialUse,
      total: box.status?.messages || 0,
      unseen: box.status?.unseen || 0,
    });
  }
  folders.sort((a, b) => folderRank(a) - folderRank(b) || a.label.localeCompare(b.label, "el"));
  return folders;
}

function isInbox(folder) {
  return String(folder.path || "").toUpperCase() === "INBOX" || folder.specialUse === "\\Inbox";
}

async function attachCounts(client, folders) {
  if (!folders.some(isInbox)) {
    folders.unshift({
      path: "INBOX",
      name: "INBOX",
      label: "Εισερχόμενα",
      specialUse: "\\Inbox",
      total: 0,
      unseen: 0,
    });
  }
  for (const folder of folders.slice(0, 12)) {
    try {
      const status = await client.status(folder.path, { messages: true, unseen: true });
      if (status && typeof status.messages === "number") {
        folder.total = status.messages;
        folder.unseen = status.unseen || 0;
      }
    } catch {
      // The name is still usable without a count.
    }
  }
  folders.sort((a, b) => folderRank(a) - folderRank(b) || a.label.localeCompare(b.label, "el"));
  return folders;
}

function plainListCaps(client) {
  const caps = client.capabilities;
  if (!caps || typeof caps.delete !== "function") return;
  for (const cap of ["LIST-EXTENDED", "SPECIAL-USE", "LIST-STATUS", "IMAP4rev2", "CHILDREN", "XLIST"]) {
    caps.delete(cap);
  }
}

async function listFolders(config) {
  try {
    return await withImap(config, async (client) => {
      const folders = boxesToFolders(await client.list({ listOnly: true }));
      return attachCounts(client, folders);
    });
  } catch (err) {
    try {
      return await withImap(config, async (client) => {
        plainListCaps(client);
        const folders = boxesToFolders(await client.list({ listOnly: true }));
        return attachCounts(client, folders);
      });
    } catch {
      const folders = await withImap(config, async (client) => {
        const boxes = [];
        for (const folderPath of KNOWN_FOLDERS) {
          try {
            const status = await client.status(folderPath, { messages: true, unseen: true });
            if (!status || typeof status.messages !== "number") continue;
            boxes.push({
              path: folderPath,
              name: folderPath.split(/[./\\]/).filter(Boolean).pop(),
              flags: new Set(),
              status,
            });
          } catch {
            // This name is not a folder on this server.
          }
        }
        return boxesToFolders(boxes);
      }).catch(() => []);
      if (!folders.length) throw err;
      return folders;
    }
  }
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
  const expectedUser = process.env.ADMIN_USER || "Thereelproject";
  const expectedPass = process.env.ADMIN_PASS || "reels4YOU";
  if (String(body.user || "") !== expectedUser || String(body.pass || "") !== expectedPass) {
    return "Δεν έχεις πρόσβαση στο ταχυδρομείο.";
  }
  return "";
}

function publicError(err) {
  const message = String(err?.message || "");
  const heard = `${message} ${err?.responseText || ""}`;
  if (/auth|invalid credentials|login|authentication failed/i.test(heard)) {
    return "Το Dreamhost δεν δέχτηκε τον κωδικό του contact@myreels.gr. Στο Vercel, το MAILBOX_PASSWORD πρέπει να είναι ο κωδικός αυτού του email.";
  }
  if (err?.status === 400) return message;
  const detail = [message, err?.responseText]
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return detail
    ? `Το ταχυδρομείο δεν απάντησε. ${detail}`
    : "Το ταχυδρομείο δεν απάντησε. Δοκίμασε ξανά.";
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
