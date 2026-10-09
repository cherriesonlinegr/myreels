export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  try {
    const { loadBoard } = await import("../lib/stay-board.mjs");
    const board = await loadBoard();
    return res.status(200).json({ ok: true, copy: board.copy || "" });
  } catch (err) {
    console.error("[myreels/reel-copy]", err?.message || err);
    return res.status(500).json({ ok: false, copy: "" });
  }
}
