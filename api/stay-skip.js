export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const body = req.body || {};
  try {
    const { loadBoard, markSkipped, saveBoard } = await import("../lib/stay-board.mjs");
    const current = await loadBoard();
    const { board, marked } = markSkipped(current, {
      videoId: body.videoId,
      property: body.property,
    });
    if (marked) await saveBoard(board);
    return res.status(200).json({ ok: true, marked });
  } catch (err) {
    console.error("[myreels/skip]", err?.message || err);
    return res.status(500).json({ ok: false });
  }
}
