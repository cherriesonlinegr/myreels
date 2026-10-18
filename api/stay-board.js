function builtInAccess(body) {
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  const adminUser = process.env.ADMIN_USER || "Thereelproject";
  const adminPass = process.env.ADMIN_PASS || "reels4YOU";
  if (user === adminUser && pass === adminPass) return { role: "admin" };
  if (user === "Nakis" && pass === "Terminator") return { role: "stay" };
  return null;
}

function openBoard(board) {
  if (!board || typeof board !== "object" || !Object.prototype.hasOwnProperty.call(board, "users")) return board;
  const { users, ...rest } = board;
  return rest;
}

function actionAllowed(access, action) {
  if (access.role === "admin") return true;
  if (action === "users" || action === "saveUser" || action === "removeUser") return false;
  const need = {
    seed: "landings",
    saveCopy: "landings",
    upsert: "landings",
    remove: "landings",
    sequences: "sequences",
    resetSequences: "sequences",
    send: "sequences",
    test: "sequences",
    reviewLink: "reviews",
    moderate: "reviews",
    archive: "pipeline",
    removeDeals: "pipeline",
    viber: "pipeline",
    edit: "pipeline",
    note: "pipeline",
    move: "pipeline",
    leads: "leads",
    leadSave: "leads",
    leadMove: "leads",
  }[action];
  if (!need) return true;
  if (access.role === "stay") return true;
  if (need === "landings") return access.permissions?.landings === true || access.permissions?.oldway === true;
  return access.permissions?.[need] === true;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const body = req.body || {};
  const action = String(body.action || "load");

  try {
    const {
      defaultSequences,
      advanceLanding,
      loginStayUser,
      markUninterested,
      markViber,
      setDealNote,
      updateDeal,
      ensureReviewToken,
      loadBoard,
      moderateReview,
      noteLead,
      publicUsers,
      removeDeals,
      removeStayUser,
      removeLanding,
      saveStayUser,
      setArchived,
      saveBoard,
      savePublicCopy,
      sendDue,
      sendOne,
      sendTest,
      upsertLanding,
    } = await import("../lib/stay-board.mjs");
    if (action === "login") {
      const result = loginStayUser(await loadBoard(), body);
      if (!result.ok) return res.status(401).json({ ok: false, error: "Δεν έχεις πρόσβαση." });
      return res.status(200).json({ ok: true, role: "sub", name: result.name, permissions: result.permissions });
    }
    let access = builtInAccess(body);
    if (!access) {
      const found = loginStayUser(await loadBoard(), body);
      if (found.ok) access = { role: "sub", permissions: found.permissions };
    }
    if (!access) return res.status(401).json({ ok: false, error: "Δεν έχεις πρόσβαση." });
    if (!actionAllowed(access, action)) return res.status(403).json({ ok: false, error: "Δεν έχεις αυτό το δικαίωμα." });
    if (action === "users") {
      return res.status(200).json({ ok: true, users: publicUsers(await loadBoard()) });
    }
    if (action === "saveUser") {
      const result = saveStayUser(await loadBoard(), body);
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      await saveBoard(result.board);
      return res.status(200).json({ ok: true, users: result.users });
    }
    if (action === "removeUser") {
      const result = removeStayUser(await loadBoard(), body);
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      await saveBoard(result.board);
      return res.status(200).json({ ok: true, users: result.users });
    }
    if (action === "load") {
      const board = await loadBoard();
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "seed") {
      let board = await loadBoard();
      for (const deal of Array.isArray(body.deals) ? body.deals : []) {
        board = upsertLanding(board, deal);
      }
      board = await saveBoard(board);
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "saveCopy") {
      const board = await saveBoard(savePublicCopy(await loadBoard(), body.copy));
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "upsert") {
      const before = await loadBoard();
      const videoId = String(body.deal?.videoId || "").trim();
      const existed = before.deals.some((item) => item.videoId === videoId);
      const board = await saveBoard(upsertLanding(before, body.deal || {}));
      let sheet = "";
      if (!existed && videoId) {
        const deal = board.deals.find((item) => item.videoId === videoId);
        sheet = await noteLead(deal?.property, "Δημιουργήθηκε landing", deal?.landingUrl || "");
      }
      return res.status(200).json({ ok: true, sheet, ...openBoard(board) });
    }
    if (action === "remove") {
      const board = await saveBoard(removeLanding(await loadBoard(), String(body.videoId || "")));
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "sequences") {
      const current = await loadBoard();
      current.sequences = body.sequences || current.sequences;
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "resetSequences") {
      const current = await loadBoard();
      current.sequences = defaultSequences();
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, ...openBoard(board) });
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
      return res.status(200).json({ ok: true, token: saved?.reviewToken || "", ...openBoard(board) });
    }
    if (action === "moderate") {
      const current = await loadBoard();
      const result = moderateReview(current, { id: body.id, status: body.status });
      if (!result.ok) return res.status(400).json({ ok: false, error: "Δεν βρέθηκε η κριτική." });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "archive") {
      const result = setArchived(await loadBoard(), { videoIds: body.videoIds, archived: body.archived !== false });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, count: result.count, ...openBoard(board) });
    }
    if (action === "removeDeals") {
      const result = removeDeals(await loadBoard(), { videoIds: body.videoIds });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, count: result.count, ...openBoard(board) });
    }
    if (action === "viber") {
      const result = markViber(await loadBoard(), { videoId: body.videoId });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "edit") {
      const result = updateDeal(await loadBoard(), body);
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "note") {
      const result = setDealNote(await loadBoard(), { videoId: body.videoId, note: body.note });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...openBoard(board) });
    }
    if (action === "move") {
      const current = await loadBoard();
      const passing = body.stage === "out";
      const result = passing
        ? markUninterested(current, { videoId: body.videoId })
        : advanceLanding(current, { videoId: body.videoId, stage: body.stage });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      if (result.changed && !passing) await sendDue(result.board, { onlyDay: 0 });
      const board = await saveBoard(result.board);
      let sheet = "";
      if (result.changed && !passing) {
        const stage = result.deal?.stage;
        const label = stage === "pack10" ? "Αγόρασε 10 Reels" : stage === "pack5" ? "Αγόρασε 5 Reels" : "Αγόρασε 1 Reel";
        sheet = await noteLead(result.deal?.property, label, "");
      }
      return res.status(200).json({ ok: true, sheet, ...openBoard(board) });
    }
    if (action === "leads" || action === "leadSave" || action === "leadMove") {
      const { listLeads, saveLead, logMovement } = await import("../lib/lead-sheet.mjs");
      if (action === "leadSave") await saveLead(body.lead || {});
      if (action === "leadMove") {
        const logged = await logMovement({
          property: body.property,
          move: body.move,
          detail: body.detail,
        });
        if (logged.skipped) {
          return res.status(503).json({
            ok: false,
            error: "Η κίνηση δεν γράφτηκε. Το Sheet πρέπει να είναι μοιρασμένο με τον λογαριασμό του site.",
          });
        }
      }
      return res.status(200).json({ ok: true, ...(await listLeads()) });
    }
    if (action === "send") {
      const current = await loadBoard();
      const count = await sendOne(current, String(body.stage || ""), String(body.emailId || ""));
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, sent: count, ...openBoard(board) });
    }
    return res.status(400).json({ ok: false, error: "Άγνωστη ενέργεια." });
  } catch (err) {
    console.error("[myreels/board]", err?.message || err);
    const status = Number(err?.status);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      error: err?.message || "Το pipeline δεν αποθηκεύτηκε.",
    });
  }
}
