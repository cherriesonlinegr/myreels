(() => {
  const stay = window.MyReelsStay;
  const params = new URLSearchParams(window.location.search);
  const name = stay.cleanName(params.get("name"));
  let firstNet = stay.parseNet(params.get("p")) ?? stay.NET;
  let pack5 = stay.parseNet(params.get("p5")) ?? stay.PACK_5;
  let pack10 = stay.parseNet(params.get("p10")) ?? stay.PACK_10;
  const ready = document.getElementById("ready");
  const missing = document.getElementById("missing");
  const done = document.getElementById("done");

  const doneId = params.get("done");
  const paidId = params.get("paid");
  if (!name && !doneId && !paidId) {
    missing.hidden = false;
    return;
  }

  let property = name;
  let reelSessionId = paidId && paidId.startsWith("cs_") ? paidId : "";
  let step = params.get("step") === "5" ? 5 : 10;
  let copyRaw = params.get("c") || "";
  if (!copyRaw) {
    try {
      copyRaw = sessionStorage.getItem("myreels_funnel_c") || "";
    } catch {
      copyRaw = "";
    }
  }
  const pages = stay.resolvePages(copyRaw);
  const preview = params.get("preview");
  if (preview === "1" || preview === "5" || preview === "10") {
    showDone(Number(preview));
    return;
  }

  const yes = document.getElementById("offer-yes");
  const no = document.getElementById("offer-no");

  yes?.addEventListener("click", () => payUpgrade(step));
  no?.addEventListener("click", () => {
    if (step === 10) {
      step = 5;
      const url = new URL(window.location.href);
      url.searchParams.set("step", "5");
      url.searchParams.delete("cancelled");
      history.replaceState(null, "", url);
      render();
      return;
    }
    showDone(1);
    markSkip();
  });

  if (doneId) confirmDone(doneId);
  else {
    ready.hidden = false;
    render();
    if (paidId) confirmReel(paidId);
    if (params.get("cancelled") === "1") {
      showError(
        "Η πληρωμή δεν ολοκληρώθηκε. Το αρχικό σου Reel παραμένει αγορασμένο. Μπορείς να δοκιμάσεις ξανά ή να συνεχίσεις μόνο με την αρχική παραγγελία."
      );
    }
  }

  function extraOf(packNet) {
    const extraNet = Math.round((Number(packNet) - Number(firstNet)) * 100) / 100;
    const extraGross = Math.round((stay.grossOf(packNet) - stay.grossOf(firstNet)) * 100) / 100;
    if (!(extraNet > 0) || !(extraGross > 0)) return null;
    return { extraNet, extraGross };
  }

  function tokensFor(packNet, extra) {
    return {
      name: property,
      net: stay.euro(firstNet),
      gross: stay.euro(stay.grossOf(firstNet)),
      pack: packNet ? stay.euro(packNet) : "",
      extra: extra ? stay.euro(extra.extraNet) : "",
      extraGross: extra ? stay.euro(extra.extraGross) : "",
    };
  }

  function setText(node, value) {
    if (!node) return;
    const text = String(value || "").trim();
    node.hidden = text.length === 0;
    node.textContent = text;
  }

  function fillList(node, raw, tokens) {
    if (!node) return;
    const lines = String(raw || "")
      .split("\n")
      .map((line) => stay.fillTokens(line, tokens).trim())
      .filter(Boolean);
    node.replaceChildren(
      ...lines.map((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        return item;
      })
    );
    node.hidden = lines.length === 0;
  }

  function paintWork(pageKey) {
    const missingOpen = missing && !missing.hidden;
    const work = document.getElementById("work");
    if (!work || missingOpen) {
      if (work) work.hidden = true;
      return;
    }
    stay.mountWork(work, pageKey, pages.samples);
  }

  function render() {
    const place = property || "κατάλυμά σου";
    const owned = document.getElementById("owned-line");
    const kicker = document.getElementById("kicker-text");
    const title = document.getElementById("offer-title");
    const lead = document.getElementById("offer-lead");
    const perks = document.getElementById("offer-perks");
    const context = document.getElementById("offer-context");
    const netNode = document.getElementById("offer-net");
    const grossNode = document.getElementById("offer-gross");
    const packNet = step === 10 ? pack10 : pack5;
    const extra = extraOf(packNet);
    const page = step === 10 ? pages.up10 : pages.up5;
    const factory = step === 10 ? stay.COPY_PAGES.find((item) => item.id === "up10").copy : stay.COPY_PAGES.find((item) => item.id === "up5").copy;
    const tokens = tokensFor(packNet, extra);
    document.title = `Συνέχεια για το ${place} · MyReels`;
    ready.classList.toggle("is-five", step === 5);
    setText(kicker, stay.fillTokens(page.kicker, tokens));
    setText(title, stay.fillTokens(page.title, tokens));
    setText(owned, stay.fillTokens(page.owned, tokens));
    setText(lead, stay.fillTokens(page.lead, tokens));
    fillList(perks, page.perks, tokens);

    if (!extra) {
      if (context) {
        context.hidden = false;
        context.textContent = "Αυτή η αναβάθμιση δεν είναι διαθέσιμη για αυτή την τιμή.";
      }
      if (netNode) netNode.textContent = "";
      if (grossNode) grossNode.textContent = "";
      if (yes) yes.hidden = true;
      paintWork(step === 10 ? "up10" : "up5");
      return;
    }
    if (yes) yes.hidden = false;
    setText(context, stay.fillTokens(page.context, tokens));
    if (netNode) netNode.textContent = stay.euro(extra.extraNet);
    if (grossNode) grossNode.textContent = `${stay.euro(extra.extraGross)} με ΦΠΑ`;
    if (yes) yes.textContent = stay.fillTokens(page.yes, tokens).trim() || stay.fillTokens(factory.yes, tokens);
    if (no) no.textContent = stay.fillTokens(page.no, tokens).trim() || stay.fillTokens(factory.no, tokens);
    paintWork(step === 10 ? "up10" : "up5");
  }

  async function confirmReel(id) {
    const order = await readOrder(id);
    if (!order || order.kind !== "reel") {
      showError("Η πληρωμή του πρώτου Reel δεν ολοκληρώθηκε.");
      return;
    }
    reelSessionId = id;
    if (order.property) property = order.property;
    const paidNet = stay.parseNet(order.net);
    const next5 = stay.parseNet(order.pack5Net);
    const next10 = stay.parseNet(order.pack10Net);
    if (paidNet != null) firstNet = paidNet;
    if (next5 != null) pack5 = next5;
    if (next10 != null) pack10 = next10;
    if (order.upgraded === 5 || order.upgraded === 10) {
      showDone(order.upgraded);
      return;
    }
    render();
  }

  async function confirmDone(id) {
    const order = await readOrder(id);
    if (!order || order.kind !== "pack") {
      ready.hidden = false;
      render();
      showError(
        "Η πληρωμή δεν ολοκληρώθηκε. Το αρχικό σου Reel παραμένει αγορασμένο. Μπορείς να δοκιμάσεις ξανά ή να συνεχίσεις μόνο με την αρχική παραγγελία."
      );
      return;
    }
    if (order.property) property = order.property;
    showDone(order.pack === 5 ? 5 : 10);
  }

  async function readOrder(id) {
    try {
      const response = await fetch(`/api/checkout?session_id=${encodeURIComponent(id)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.order) return null;
      return payload.order;
    } catch {
      return null;
    }
  }

  function savedOrder() {
    try {
      const data = JSON.parse(sessionStorage.getItem("myreels_reel_order") || "");
      if (!data || !data.email || !data.name) return null;
      return data;
    } catch {
      return null;
    }
  }

  async function payUpgrade(count) {
    const errorEl = document.getElementById("form-error");
    if (errorEl) errorEl.hidden = true;
    if (!reelSessionId) {
      await sendUpgradeLead(count);
      return;
    }
    if (yes) {
      yes.disabled = true;
      yes.textContent = "Μετάβαση στην πληρωμή…";
    }
    if (no) no.disabled = true;
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pack", sessionId: reelSessionId, pack: count }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Η πληρωμή δεν άνοιξε.");
      }
      window.location.assign(payload.url);
    } catch (err) {
      if (yes) yes.disabled = false;
      if (no) no.disabled = false;
      render();
      showError(err?.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
    }
  }

  async function sendUpgradeLead(count) {
    const order = savedOrder();
    if (!order) {
      showError("Στείλε πρώτα την παραγγελία του πρώτου Reel από τη σελίδα του.");
      return;
    }
    if (yes) {
      yes.disabled = true;
      yes.textContent = "Στέλνουμε την παραγγελία…";
    }
    if (no) no.disabled = true;
    const packNet = count === 10 ? pack10 : pack5;
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: order.name,
          business: order.property || property,
          email: order.email,
          phone: order.phone || "",
          services: [count === 10 ? "stay10" : "stay5"],
          source: "upsell",
          pack: count,
          priceNet: packNet,
          notes:
            count === 10
              ? `10 Reels και διαχείριση social 2 μηνών για το ${order.property || property}. Έχει ήδη το πρώτο Reel.`
              : `5 Reels για το ${order.property || property}, χωρίς διαχείριση social. Έχει ήδη το πρώτο Reel.`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Η παραγγελία δεν στάλθηκε.");
      }
      showDone(count);
    } catch (err) {
      if (yes) yes.disabled = false;
      if (no) no.disabled = false;
      render();
      showError(err?.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
    }
  }

  function markSkip() {
    const videoId = stay.parseYouTubeId(params.get("v"));
    fetch("/api/stay-skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, property }),
    }).catch(() => {});
  }

  function showError(message) {
    const errorEl = document.getElementById("form-error");
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function showDone(count) {
    ready.hidden = true;
    const title = document.getElementById("done-title");
    const text = document.getElementById("done-text");
    const tokens = tokensFor(0, null);
    const key = count === 10 ? "ten" : count === 5 ? "five" : "one";
    setText(title, stay.fillTokens(pages.done[`${key}Title`], tokens));
    setText(text, stay.fillTokens(pages.done[`${key}Text`], tokens));
    done.hidden = false;
    paintWork(count === 10 ? "done10" : count === 5 ? "done5" : "done1");
    window.scrollTo(0, 0);
  }
})();
