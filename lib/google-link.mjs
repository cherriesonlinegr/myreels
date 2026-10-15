import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mailboxConfig, withImap } from "./mailbox.mjs";

const ACCOUNT = "myreels.gr@gmail.com";
const FOLDER = "INBOX.MyReelsGoogle";
const DRIVE_FOLDER = "MyReels";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

function clean(value) {
  return String(value || "").trim();
}

export function googleAccount() {
  return clean(process.env.GOOGLE_ACCOUNT || ACCOUNT).toLowerCase();
}

function clientId() {
  return clean(process.env.GOOGLE_CLIENT_ID);
}

function clientSecret() {
  return clean(process.env.GOOGLE_CLIENT_SECRET);
}

export function googleConfigured() {
  return Boolean(clientId() && clientSecret());
}

function stateSecret() {
  return clientSecret() || clean(process.env.ADMIN_PASS) || "myreels";
}

export function googleRedirectUri(req) {
  const fixed = clean(process.env.GOOGLE_REDIRECT_URI);
  if (fixed) return fixed;
  const proto = clean(req?.headers?.["x-forwarded-proto"]).split(",")[0] || "https";
  const host = clean(req?.headers?.["x-forwarded-host"] || req?.headers?.host).split(",")[0];
  if (!host) return "https://myreels.gr/api/google-oauth";
  return `${proto}://${host}/api/google-oauth`;
}

export function signState(redirectUri) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 15 * 60 * 1000, redirectUri })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readState(state) {
  const raw = clean(state);
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.redirectUri || Number(data.exp) < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function googleAuthUrl(redirectUri) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("login_hint", googleAccount());
  url.searchParams.set("state", signState(redirectUri));
  return url.toString();
}

function linkFile() {
  if (process.env.VERCEL) return "";
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    return path.join(root, "data", "google-link.json");
  } catch {
    return "";
  }
}

function readFileLink() {
  try {
    const file = linkFile();
    if (!file || !fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed?.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

function writeFileLink(link) {
  if (process.env.VERCEL) return;
  const file = linkFile();
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!link) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  fs.writeFileSync(file, JSON.stringify(link));
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

async function loadImapLink(config) {
  return withImap(config, async (client) => {
    await ensureFolder(client);
    const lock = await client.getMailboxLock(FOLDER);
    try {
      const exists = client.mailbox?.exists || 0;
      if (!exists) return null;
      let latest = null;
      for await (const msg of client.fetch(`${Math.max(1, exists - 2)}:*`, { source: true })) {
        latest = msg;
      }
      if (!latest?.source) return null;
      const text = latest.source.toString("utf8");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < start) return null;
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed?.refreshToken ? parsed : null;
    } finally {
      lock.release();
    }
  });
}

async function saveImapLink(config, link) {
  await withImap(config, async (client) => {
    await ensureFolder(client);
    const lock = await client.getMailboxLock(FOLDER);
    try {
      const uids = await client.search({ all: true }, { uid: true });
      if (link) {
        const raw = Buffer.from(
          `From: MyReels <${config.email}>\r\nTo: ${config.email}\r\nSubject: myreels-google-link\r\nMIME-Version: 1.0\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(link)}`,
          "utf8"
        );
        await client.append(FOLDER, raw, ["\\Seen"]);
      }
      if (Array.isArray(uids) && uids.length) await client.messageDelete(uids, { uid: true });
    } finally {
      lock.release();
    }
  });
}

async function loadLink() {
  const config = mailboxConfig();
  if (config) {
    try {
      const remote = await loadImapLink(config);
      if (remote?.refreshToken) return remote;
    } catch (err) {
      console.error("[myreels/google] load", err?.message || err);
      if (process.env.VERCEL) throw new Error("Η αποθηκευμένη σύνδεση δεν διαβάστηκε.");
    }
  } else if (process.env.VERCEL) {
    throw new Error("Λείπει το mailbox για να κρατηθεί η σύνδεση.");
  }
  return readFileLink();
}

async function saveLink(link) {
  writeFileLink(link);
  const config = mailboxConfig();
  if (config) await saveImapLink(config, link);
  else if (process.env.VERCEL) throw new Error("Λείπει το mailbox για να κρατηθεί η σύνδεση.");
}

function googleError(data, fallback) {
  const reason = data?.error?.message || data?.error_description || data?.error || "";
  if (reason === "invalid_grant") return "Η σύνδεση έληξε. Ξανασυνδέσου.";
  if (typeof reason === "string" && reason && reason.length < 180 && !reason.startsWith("{")) return reason;
  return fallback;
}

async function tokenRequest(fields) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(googleError(data, "Η Google δεν δέχτηκε τη σύνδεση."));
  return data;
}

async function accessToken(refreshToken) {
  const data = await tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (!data.access_token) throw new Error("Η Google δεν έδωσε πρόσβαση.");
  return data.access_token;
}

async function googleFetch(url, access, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${access}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(googleError(data, "Η Google δεν απάντησε."));
  return data;
}

async function revoke(token) {
  if (!token) return;
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

async function ensureDriveFolder(access, currentId) {
  if (currentId) {
    try {
      const found = await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(currentId)}?fields=id,trashed`,
        access
      );
      if (found?.id && !found.trashed) return found.id;
    } catch {
      /* The folder was removed. Create it again. */
    }
  }
  const query = `name = '${DRIVE_FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listed = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&pageSize=1`,
    access
  );
  if (listed.files?.[0]?.id) return listed.files[0].id;
  const created = await googleFetch("https://www.googleapis.com/drive/v3/files", access, {
    method: "POST",
    body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!created.id) throw new Error("Ο φάκελος στο Drive δεν δημιουργήθηκε.");
  return created.id;
}

function publicLink(link, extra = {}) {
  const folderId = link?.folderId || "";
  return {
    ok: true,
    configured: googleConfigured(),
    connected: Boolean(link?.refreshToken),
    account: googleAccount(),
    email: link?.email || "",
    channelId: link?.channelId || "",
    channelTitle: link?.channelTitle || "",
    folderId,
    folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : "",
    ...extra,
  };
}

export async function googleStatus({ live = false } = {}) {
  const missing = [];
  if (!clientId()) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret()) missing.push("GOOGLE_CLIENT_SECRET");
  if (process.env.VERCEL && !mailboxConfig()) missing.push("MAILBOX_PASSWORD");
  if (missing.length) {
    return { ok: true, configured: false, connected: false, account: googleAccount(), missing };
  }
  const link = await loadLink();
  if (!link?.refreshToken) {
    return { ok: true, configured: true, connected: false, account: googleAccount() };
  }
  if (!live) return publicLink(link);
  try {
    const access = await accessToken(link.refreshToken);
    const profile = await googleFetch("https://www.googleapis.com/oauth2/v2/userinfo", access);
    const channels = await googleFetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      access
    );
    const channel = channels.items?.[0];
    const folderId = await ensureDriveFolder(access, link.folderId);
    const next = {
      ...link,
      email: String(profile.email || link.email || "").toLowerCase(),
      channelId: channel?.id || "",
      channelTitle: channel?.snippet?.title || "",
      folderId,
    };
    if (
      next.email !== link.email ||
      next.channelId !== link.channelId ||
      next.channelTitle !== link.channelTitle ||
      next.folderId !== link.folderId
    ) {
      await saveLink(next);
    }
    const status = publicLink(next);
    if (!next.channelId) status.error = "Ο λογαριασμός δεν έχει κανάλι YouTube.";
    return status;
  } catch (err) {
    if (/έληξε|invalid_grant/i.test(String(err?.message || ""))) await saveLink(null).catch(() => {});
    return publicLink(null, {
      configured: true,
      connected: false,
      error: err?.message || "Η σύνδεση έληξε. Ξανασυνδέσου.",
    });
  }
}

export async function connectGoogle(code, redirectUri) {
  const tokens = await tokenRequest({
    code: clean(code),
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!tokens.refresh_token) throw new Error("Η Google δεν έδωσε μόνιμη άδεια. Ξαναπροσπάθησε.");
  const access = tokens.access_token;
  const profile = await googleFetch("https://www.googleapis.com/oauth2/v2/userinfo", access);
  const email = String(profile.email || "").toLowerCase();
  if (email !== googleAccount()) {
    await revoke(tokens.refresh_token);
    throw new Error(`Συνδέθηκες ως ${email || "άλλος λογαριασμός"}. Χρειάζεται ο ${googleAccount()}.`);
  }
  const channels = await googleFetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    access
  );
  const channel = channels.items?.[0];
  if (!channel?.id) {
    await revoke(tokens.refresh_token);
    throw new Error("Αυτός ο λογαριασμός δεν έχει κανάλι YouTube. Άνοιξέ το μία φορά με το myreels.gr@gmail.com και ξανασυνδέσου.");
  }
  const folderId = await ensureDriveFolder(access, "");
  await saveLink({
    refreshToken: tokens.refresh_token,
    email,
    channelId: channel.id,
    channelTitle: channel.snippet?.title || "",
    folderId,
    connectedAt: new Date().toISOString(),
  });
}

export async function disconnectGoogle() {
  const link = await loadLink();
  if (link?.refreshToken) await revoke(link.refreshToken);
  await saveLink(null);
}
