import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mailboxConfig, withImap } from "./mailbox.mjs";

const ACCOUNT = "myreels.gr@gmail.com";
const FOLDER = "INBOX.MyReelsGoogle";
const DRIVE_FOLDER = "MyReels";

const SERVICES = {
  youtube: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ],
  drive: ["openid", "email", "https://www.googleapis.com/auth/drive.file"],
};

function serviceKind(value) {
  return value === "drive" ? "drive" : "youtube";
}

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

export function signState(redirectUri, service) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 15 * 60 * 1000, redirectUri, service: serviceKind(service) })
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

export function googleAuthUrl(redirectUri, service) {
  const kind = serviceKind(service);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SERVICES[kind].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("login_hint", googleAccount());
  url.searchParams.set("state", signState(redirectUri, kind));
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
    return parsed?.youtubeRefreshToken || parsed?.driveRefreshToken ? parsed : null;
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
      return parsed?.youtubeRefreshToken || parsed?.driveRefreshToken ? parsed : null;
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
      if (remote?.youtubeRefreshToken || remote?.driveRefreshToken) return remote;
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
  const youtube = Boolean(link?.youtubeRefreshToken);
  const drive = Boolean(link?.driveRefreshToken);
  return {
    ok: true,
    configured: googleConfigured(),
    connected: youtube && drive,
    youtube,
    drive,
    account: googleAccount(),
    email: link?.email || "",
    channelId: youtube ? link?.channelId || "" : "",
    channelTitle: youtube ? link?.channelTitle || "" : "",
    folderId: drive ? folderId : "",
    folderUrl: drive && folderId ? `https://drive.google.com/drive/folders/${folderId}` : "",
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
  if (!link?.youtubeRefreshToken && !link?.driveRefreshToken) {
    return { ok: true, configured: true, connected: false, youtube: false, drive: false, account: googleAccount() };
  }
  if (!live) return publicLink(link);
  const next = { ...link };
  let error = "";
  if (next.youtubeRefreshToken) {
    try {
      const access = await accessToken(next.youtubeRefreshToken);
      const profile = await googleFetch("https://www.googleapis.com/oauth2/v2/userinfo", access);
      const channels = await googleFetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        access
      );
      const channel = channels.items?.[0];
      next.email = String(profile.email || next.email || "").toLowerCase();
      next.channelId = channel?.id || "";
      next.channelTitle = channel?.snippet?.title || "";
      if (!next.channelId) error = "Ο λογαριασμός δεν έχει κανάλι YouTube.";
    } catch (err) {
      if (/έληξε|invalid_grant/i.test(String(err?.message || ""))) next.youtubeRefreshToken = "";
      error = err?.message || "Η σύνδεση YouTube έληξε. Ξανασυνδέσου.";
    }
  }
  if (next.driveRefreshToken) {
    try {
      const access = await accessToken(next.driveRefreshToken);
      next.folderId = await ensureDriveFolder(access, next.folderId);
    } catch (err) {
      if (/έληξε|invalid_grant/i.test(String(err?.message || ""))) next.driveRefreshToken = "";
      error = error || err?.message || "Η σύνδεση Drive έληξε. Ξανασυνδέσου.";
    }
  }
  if (!next.youtubeRefreshToken) {
    next.channelId = "";
    next.channelTitle = "";
  }
  if (!next.driveRefreshToken) next.folderId = "";
  const changed =
    next.email !== link.email ||
    next.channelId !== link.channelId ||
    next.channelTitle !== link.channelTitle ||
    next.folderId !== link.folderId ||
    next.youtubeRefreshToken !== link.youtubeRefreshToken ||
    next.driveRefreshToken !== link.driveRefreshToken;
  if (changed) await saveLink(next.youtubeRefreshToken || next.driveRefreshToken ? next : null);
  const status = publicLink(next.youtubeRefreshToken || next.driveRefreshToken ? next : null);
  if (error) status.error = error;
  return status;
}

export async function connectGoogle(code, redirectUri, service) {
  const kind = serviceKind(service);
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
  const previous = (await loadLink()) || {};
  const next = {
    email,
    channelId: previous.channelId || "",
    channelTitle: previous.channelTitle || "",
    folderId: previous.folderId || "",
    youtubeRefreshToken: previous.youtubeRefreshToken || "",
    driveRefreshToken: previous.driveRefreshToken || "",
    connectedAt: previous.connectedAt || new Date().toISOString(),
  };
  if (kind === "youtube") {
    const channels = await googleFetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      access
    );
    const channel = channels.items?.[0];
    if (!channel?.id) {
      await revoke(tokens.refresh_token);
      throw new Error("Αυτός ο λογαριασμός δεν έχει κανάλι YouTube. Άνοιξέ το μία φορά με το myreels.gr@gmail.com και ξανασυνδέσου.");
    }
    if (next.youtubeRefreshToken && next.youtubeRefreshToken !== tokens.refresh_token) await revoke(next.youtubeRefreshToken);
    next.youtubeRefreshToken = tokens.refresh_token;
    next.channelId = channel.id;
    next.channelTitle = channel.snippet?.title || "";
  } else {
    if (next.driveRefreshToken && next.driveRefreshToken !== tokens.refresh_token) await revoke(next.driveRefreshToken);
    next.driveRefreshToken = tokens.refresh_token;
    next.folderId = await ensureDriveFolder(access, next.folderId);
  }
  await saveLink(next);
  return kind;
}

export async function disconnectGoogle() {
  const link = await loadLink();
  if (link?.youtubeRefreshToken) await revoke(link.youtubeRefreshToken);
  if (link?.driveRefreshToken) await revoke(link.driveRefreshToken);
  await saveLink(null);
}

function adminDenied(body) {
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  const adminUser = process.env.ADMIN_USER || "Thereelproject";
  const adminPass = process.env.ADMIN_PASS || "reels4YOU";
  if (user === adminUser && pass === adminPass) return "";
  return "Δεν έχεις πρόσβαση.";
}

export async function handleGoogleLink(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const body = req.body || {};
  const denied = adminDenied(body);
  if (denied) return res.status(401).json({ ok: false, error: denied });

  try {
    const action = String(body.action || "status");
    if (action === "status") return res.status(200).json(await googleStatus({ live: body.live === true }));
    if (action === "start") {
      if (!googleConfigured()) {
        return res.status(400).json({
          ok: false,
          error: "Λείπουν το GOOGLE_CLIENT_ID και το GOOGLE_CLIENT_SECRET από το Vercel.",
          ...(await googleStatus()),
        });
      }
      return res.status(200).json({
        ok: true,
        url: googleAuthUrl(googleRedirectUri(req), body.service),
      });
    }
    if (action === "access") {
      const kind = body.service === "drive" ? "drive" : "youtube";
      const link = await loadLink();
      const refresh = kind === "drive" ? link?.driveRefreshToken : link?.youtubeRefreshToken;
      if (!refresh) {
        return res.status(400).json({
          ok: false,
          error: kind === "drive" ? "Σύνδεσε πρώτα το Drive." : "Σύνδεσε πρώτα το YouTube.",
        });
      }
      const token = await accessToken(refresh);
      if (kind === "drive") {
        const folderId = await ensureDriveFolder(token, link.folderId || "");
        if (folderId !== link.folderId) await saveLink({ ...link, folderId });
        return res.status(200).json({ ok: true, accessToken: token, folderId });
      }
      return res.status(200).json({ ok: true, accessToken: token });
    }
    if (action === "disconnect") {
      await disconnectGoogle();
      return res.status(200).json(await googleStatus());
    }
    return res.status(400).json({ ok: false, error: "Άγνωστη ενέργεια." });
  } catch (err) {
    console.error("[myreels/google]", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "Η Google δεν απάντησε." });
  }
}

function oauthBack(res, query) {
  res.writeHead(302, { Location: `/admin?${query}`, "Cache-Control": "no-store" });
  res.end();
}

export async function handleGoogleOAuth(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const error = String(req.query.error || "");
  if (error) {
    const message = error === "access_denied" ? "Ακύρωσες τη σύνδεση." : "Η Google δεν ολοκλήρωσε τη σύνδεση.";
    return oauthBack(res, `google=error&reason=${encodeURIComponent(message)}`);
  }

  try {
    const state = readState(req.query.state);
    if (!state) return oauthBack(res, `google=error&reason=${encodeURIComponent("Η σύνδεση έληξε. Ξαναπροσπάθησε.")}`);
    const kind = await connectGoogle(String(req.query.code || ""), state.redirectUri, state.service);
    return oauthBack(res, `google=${kind}`);
  } catch (err) {
    console.error("[myreels/google] oauth", err?.message || err);
    const message = String(err?.message || "Η σύνδεση δεν ολοκληρώθηκε.").slice(0, 180);
    return oauthBack(res, `google=error&reason=${encodeURIComponent(message)}`);
  }
}
