import { readFileSync } from "fs";
import { join } from "path";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanName(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function euroLabel(value) {
  const amount = Number(String(value || "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return "40€";
  const cents = Math.round(amount * 100);
  return `${new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}€`;
}

export function reelPreviewHtml(html, { name, videoId, net, pageUrl, image }) {
  const title = name
    ? `Το Reel του ${name} είναι ήδη έτοιμο`
    : "Το Reel του καταλύματός σου είναι ήδη έτοιμο";
  const description = `Το φτιάξαμε από τις φωτογραφίες που έχεις ήδη online. ${euroLabel(net)} χωρίς ΦΠΑ.`;
  const tags = `
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:secure_url" content="${esc(image)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />`;

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} · MyReels</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${esc(description)}" />`
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${esc(title)}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${esc(description)}" />`
    )
    .replace("</head>", `${tags}\n</head>`);
}

export default async function handler(req, res) {
  const pathName = cleanName(req.query?.name);
  let name = pathName;
  let videoId = /^[\w-]{11}$/.test(String(req.query?.v || "")) ? String(req.query.v) : "";
  let net = req.query?.p;
  if (name && !videoId) {
    try {
      const { loadBoard, publicLanding } = await import("../lib/stay-board.mjs");
      const found = publicLanding(await loadBoard(), name);
      if (found) {
        name = found.property || name;
        videoId = found.videoId;
        net = found.net;
      }
    } catch (err) {
      console.error("[myreels/reel-page]", err?.message || err);
    }
  }
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "www.myreels.gr")
    .split(",")[0]
    .trim();
  const params = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (key === "name" || typeof value !== "string") return;
    params.set(key, value);
  });
  const query = params.toString();
  const pageUrl = pathName
    ? `${proto}://${host}/myairbnbreels/${encodeURIComponent(pathName)}${query ? `?${query}` : ""}`
    : `${proto}://${host}/reel${query ? `?${query}` : ""}`;
  const image = videoId
    ? `${proto}://${host}/api/reel-thumb?v=${videoId}`
    : `${proto}://${host}/favicon.png`;
  const html = readFileSync(join(process.cwd(), "templates", "reel.html"), "utf8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(reelPreviewHtml(html, { name, videoId, net, pageUrl, image }));
}
