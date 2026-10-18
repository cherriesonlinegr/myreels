function builtInAccess(body) {
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  const adminUser = process.env.ADMIN_USER || "Thereelproject";
  const adminPass = process.env.ADMIN_PASS || "reels4YOU";
  if (user === adminUser && pass === adminPass) return { role: "admin" };
  return null;
}

function openBoard(board, access) {
  if (!board || typeof board !== "object") return board;
  const { users, leadSync, ...rest } = board;
  if (access?.role === "admin" || !Array.isArray(rest.deals)) return rest;
  return {
    ...rest,
    deals: rest.deals.map((deal) => {
      const { log, noteBy, noteByName, noteAt, uploadedBy, uploadedAt, ...pub } = deal;
      return pub;
    }),
  };
}

function actorOf(body, access) {
  const user = String(body.user || "admin").slice(0, 32);
  const name = String(access.role === "admin" ? "Admin" : access.name || user).slice(0, 80);
  return { user, name };
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
    move: "pipeline",
    leadSave: "leads",
    leadMove: "leads",
    costSave: "finance",
    costRemove: "finance",
  }[action];
  if (!need) return true;
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
      markOutreach,
      removeCost,
      saveCost,
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
      syncLeadSheet,
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
      if (found.ok) access = { role: "sub", name: found.name, permissions: found.permissions };
    }
    if (!access) return res.status(401).json({ ok: false, error: "Δεν έχεις πρόσβαση." });
    if (!actionAllowed(access, action)) return res.status(403).json({ ok: false, error: "Δεν έχεις αυτό το δικαίωμα." });
    const actor = actorOf(body, access);
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
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "seed") {
      let board = await loadBoard();
      for (const deal of Array.isArray(body.deals) ? body.deals : []) {
        board = upsertLanding(board, { ...deal, actor, record: false });
      }
      board = await saveBoard(board);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "saveCopy") {
      const board = await saveBoard(savePublicCopy(await loadBoard(), body.copy));
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "upsert") {
      const before = await loadBoard();
      const videoId = String(body.deal?.videoId || "").trim();
      const existed = before.deals.some((item) => item.videoId === videoId);
      const board = await saveBoard(upsertLanding(before, { ...(body.deal || {}), actor, record: true }));
      let sheet = "";
      if (!existed && videoId) {
        const deal = board.deals.find((item) => item.videoId === videoId);
        sheet = await noteLead(deal?.property, "Δημιουργήθηκε landing", deal?.landingUrl || "", deal);
      }
      return res.status(200).json({ ok: true, sheet, ...openBoard(board, access) });
    }
    if (action === "remove") {
      const board = await saveBoard(removeLanding(await loadBoard(), String(body.videoId || "")));
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "sequences") {
      const current = await loadBoard();
      current.sequences = body.sequences || current.sequences;
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "resetSequences") {
      const current = await loadBoard();
      current.sequences = defaultSequences();
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
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
      return res.status(200).json({ ok: true, token: saved?.reviewToken || "", ...openBoard(board, access) });
    }
    if (action === "moderate") {
      const current = await loadBoard();
      const result = moderateReview(current, { id: body.id, status: body.status });
      if (!result.ok) return res.status(400).json({ ok: false, error: "Δεν βρέθηκε η κριτική." });
      const board = await saveBoard(result.board);
      const review = board.reviews.find((item) => item.id === String(body.id || ""));
      if (review) {
        await noteLead(review.property, review.status === "approved" ? "Κριτική στη σελίδα" : "Κριτική εκτός σελίδας", "", board.deals.find((item) => item.property === review.property));
      }
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "archive") {
      const before = await loadBoard();
      const ids = new Set((Array.isArray(body.videoIds) ? body.videoIds : []).map((id) => String(id || "")));
      const archived = body.archived !== false;
      const result = setArchived(before, { videoIds: body.videoIds, archived, actor });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      for (const deal of before.deals) {
        if (!ids.has(deal.videoId) || deal.archived === archived) continue;
        await noteLead(deal.property, archived ? "Αρχειοθέτηση" : "Επαναφορά", "", deal);
      }
      return res.status(200).json({ ok: true, count: result.count, ...openBoard(board, access) });
    }
    if (action === "removeDeals") {
      const result = removeDeals(await loadBoard(), { videoIds: body.videoIds });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, count: result.count, ...openBoard(board, access) });
    }
    if (action === "viber") {
      const result = markViber(await loadBoard(), { videoId: body.videoId, actor });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      await noteLead(result.deal?.property, "Viber", "", result.deal);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "edit") {
      const result = updateDeal(await loadBoard(), { ...body, actor });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      await noteLead(result.deal?.property, "Στοιχεία πελάτη", "", result.deal);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "outreach") {
      const result = markOutreach(await loadBoard(), { videoId: body.videoId, id: body.id });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      const sheet = await noteLead(result.deal?.property, result.label, "", result.deal);
      return res.status(200).json({ ok: true, sheet, ...openBoard(board, access) });
    }
    if (action === "costSave") {
      const result = saveCost(await loadBoard(), body);
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "costRemove") {
      const result = removeCost(await loadBoard(), { id: body.id });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "note") {
      const result = setDealNote(await loadBoard(), { videoId: body.videoId, note: body.note, actor });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      const board = await saveBoard(result.board);
      await noteLead(result.deal?.property, "Σημείωση", result.deal?.note || "", result.deal);
      return res.status(200).json({ ok: true, ...openBoard(board, access) });
    }
    if (action === "move") {
      const current = await loadBoard();
      const passing = body.stage === "out";
      const result = passing
        ? markUninterested(current, { videoId: body.videoId, actor })
        : advanceLanding(current, { videoId: body.videoId, stage: body.stage, actor });
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
      if (result.changed && !passing) await sendDue(result.board, { onlyDay: 0 });
      const board = await saveBoard(result.board);
      let sheet = "";
      if (result.changed && passing) {
        sheet = await noteLead(result.deal?.property, "Δεν ενδιαφέρεται", "", result.deal);
      } else if (result.changed) {
        const stage = result.deal?.stage;
        const label = stage === "pack10" ? "Αγόρασε 10 Reels" : stage === "pack5" ? "Αγόρασε 5 Reels" : "Αγόρασε 1 Reel";
        sheet = await noteLead(result.deal?.property, label, "", result.deal);
      }
      return res.status(200).json({ ok: true, sheet, ...openBoard(board, access) });
    }
    if (action === "leads" || action === "leadSync" || action === "leadSave" || action === "leadMove") {
      const { saveLead, logMovement, movesFromLeadNotes } = await import("../lib/lead-sheet.mjs");
      if (action === "leadSave") await saveLead(body.lead || {});
      if (action === "leadMove") {
        const logged = await logMovement({
          property: body.property,
          move: body.move,
          detail: body.detail,
        });
        if (logged.skipped || logged.error) {
          return res.status(logged.skipped ? 503 : 400).json({
            ok: false,
            error: logged.error || "Η κίνηση δεν γράφτηκε. Το Sheet πρέπει να είναι μοιρασμένο με τον λογαριασμό του site.",
          });
        }
      }
      const fresh = action === "leads" ? await loadBoard() : null;
      const at = Date.parse(fresh?.leadSync?.at || "");
      if (fresh?.leadSync?.leads?.length && Number.isFinite(at) && Date.now() - at < 22 * 60 * 60 * 1000) {
        return res.status(200).json({
          ok: true,
          leads: fresh.leadSync.leads,
          moves: movesFromLeadNotes(fresh.leadSync.leads),
          canWrite: fresh.leadSync.canWrite === true,
          syncedAt: fresh.leadSync.at,
        });
      }
      return res.status(200).json({ ok: true, ...(await syncLeadSheet()) });
    }
    if (action === "send") {
      const current = await loadBoard();
      const count = await sendOne(current, String(body.stage || ""), String(body.emailId || ""));
      const board = await saveBoard(current);
      return res.status(200).json({ ok: true, sent: count, ...openBoard(board, access) });
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
