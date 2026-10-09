export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { loadBoard, publicReviews, reviewForm, saveBoard, submitReview } = await import("../lib/stay-board.mjs");
    if (req.method === "GET" && String(req.query?.list || "") === "1") {
      return res.status(200).json({ ok: true, reviews: publicReviews(await loadBoard()) });
    }
    if (req.method === "GET") {
      const query = req.query || {};
      const form = reviewForm(
        await loadBoard(),
        query.t || { videoId: query.v || "", property: query.property || query.name || "" }
      );
      if (!form) return res.status(404).json({ ok: false, error: "Αυτός ο σύνδεσμος δεν ανοίγει φόρμα." });
      return res.status(200).json({ ok: true, ...form });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    const body = req.body || {};
    if (String(body.website || "").trim()) return res.status(200).json({ ok: true });
    const result = submitReview(await loadBoard(), body);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error || "Δεν στάλθηκε." });
    if (!result.already) await saveBoard(result.board);
    return res.status(200).json({ ok: true, already: result.already === true });
  } catch (err) {
    console.error("[myreels/review]", err?.message || err);
    return res.status(500).json({ ok: false, error: "Η φόρμα δεν άνοιξε." });
  }
}
