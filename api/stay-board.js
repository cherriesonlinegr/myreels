function adminDenied(body) {
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  const adminUser = process.env.ADMIN_USER || "Thereelproject";
  const adminPass = process.env.ADMIN_PASS || "reels4YOU";
  const admin = user === adminUser && pass === adminPass;
  const stay = user === "Nakis" && pass === "Terminator";
  if (!admin && !stay) return "Δεν έχεις πρόσβαση.";
  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const body = req.body || {};
  const denied = adminDenied(body);
  if (denied) return res.status(401).json({ ok: false, error: denied });

  try {
    const {
      defaultSequences,
      ensureReviewToken,
      loadBoard,
      moderateReview,
      removeLanding,
      saveBoard,
      savePublicCopy,
      sendOne,
      sendTest,
      upsertLanding,
    } = await import("../lib/stay-board.mjs");
    const action = String(body.action || "load");
    if (action === "load") {
      const board = await loadBoard();
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "seed") {
      let board = await loadBoard();
      for (const deal of Array.isArray(body.deals) ? body.deals : []) {
        board = upsertLanding(board, deal);
      }
      board = await saveBoard(board);
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "saveCopy") {
      const board = await saveBoard(savePublicCopy(await loadBoard(), body.copy));
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "upsert") {
      const board = await saveBoard(upsertLanding(await loadBoard(), body.deal || {}));
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "remove") {
      const board = await saveBoard(removeLanding(await loadBoard(), String(body.videoId || "")));
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "sequences") {
      const current = await loadBoard();
      current.sequences = body.sequences || current.sequences;
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "resetSequences") {
      const current = await loadBoard();
      current.sequences = defaultSequences();
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "test") {
      const result = await sendTest({
        to: body.to,
        subject: body.subject,
        body: body.body,
        stage: body.stage,
      });
      return res.status(200).json({ ok: true, ...result });
    }
    if (action === "reviewLink") {
      const current = await loadBoard();
      const videoId = String(body.videoId || "");
      const property = String(body.property || "").trim();
      const deal = current.deals.find(
        (item) => (videoId && item.videoId === videoId) || (property && item.property === property)
      );
      if (!deal || deal.stage === "landing") {
        return res.status(400).json({ ok: false, error: "Δεν υπάρχει ακόμα φόρμα για αυτό το κατάλυμα." });
      }
      ensureReviewToken(deal);
      const board = await saveBoard(current);
      const saved = board.deals.find((item) => item.id === deal.id);
      return res.status(200).json({ ok: true, token: saved?.reviewToken || "", ...board });
    }
    if (action === "moderate") {
      const current = await loadBoard();
      const result = moderateReview(current, { id: body.id, status: body.status });
      if (!result.ok) return res.status(400).json({ ok: false, error: "Δεν βρέθηκε η κριτική." });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...board });
    }
    if (action === "send") {
      const current = await loadBoard();
      const count = await sendOne(current, String(body.stage || ""), String(body.emailId || ""));
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, sent: count, ...board });
    }
    return res.status(400).json({ ok: false, error: "Άγνωστη ενέργεια." });
  } catch (err) {
    console.error("[myreels/board]", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "Το pipeline δεν αποθηκεύτηκε." });
  }
}
