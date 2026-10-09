export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  res.setHeader("Cache-Control", "no-store");
  try {
    const { loadBoard, publicReviews } = await import("../lib/stay-board.mjs");
    return res.status(200).json({ ok: true, reviews: publicReviews(await loadBoard()) });
  } catch (err) {
    console.error("[myreels/reviews]", err?.message || err);
    return res.status(500).json({ ok: false, reviews: [] });
  }
}
