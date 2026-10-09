export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  try {
    const { loadBoard, publicLanding } = await import("../lib/stay-board.mjs");
    if (String(req.query?.samples || "") === "1") {
      const board = await loadBoard();
      return res.status(200).json({ ok: true, copy: board.copy || "" });
    }
    const found = publicLanding(await loadBoard(), req.query?.slug || "");
    if (!found) return res.status(404).json({ ok: false });
    return res.status(200).json({ ok: true, ...found });
  } catch (err) {
    console.error("[myreels/reel-config]", err?.message || err);
    return res.status(500).json({ ok: false });
  }
}
