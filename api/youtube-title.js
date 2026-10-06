/**
 * Read a public YouTube title so the admin can personalize a stay landing.
 * Unlisted videos usually have no oEmbed title — the admin types the name.
 */
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
]);

function isYouTubeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const videoUrl = String(req.query.url || "").trim();
  if (!isYouTubeUrl(videoUrl)) {
    return res.status(400).json({ ok: false, error: "Μη έγκυρο YouTube link" });
  }

  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return res.status(404).json({ ok: false, error: "Ο τίτλος δεν είναι διαθέσιμος" });
    }
    const data = await response.json();
    const title = String(data?.title || "").trim().slice(0, 80);
    if (!title) return res.status(404).json({ ok: false, error: "Κενός τίτλος" });
    return res.status(200).json({ ok: true, title });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err?.message || "YouTube lookup failed" });
  }
}
