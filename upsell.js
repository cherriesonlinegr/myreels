(() => {
  const stay = window.MyReelsStay;
  stay.applyChrome();
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
  const orderCode = String(params.get("s") || "").replace(/\D/g, "");
  if (!name && !doneId && !paidId && !orderCode) {
    missing.hidden = false;
    return;
  }

  let property = name;
  let pageVideo = stay.parseYouTubeId(params.get("v"));
  let reelSessionId = paidId && paidId.startsWith("cs_") ? paidId : "";
  let step = params.get("step") === "5" ? 5 : 10;
  let funnelSent = "";
  let copyRaw = params.get("c") || "";
  if (!copyRaw) {
    try {
      copyRaw = sessionStorage.getItem("myreels_funnel_c") || "";
    } catch {
      copyRaw = "";
    }
  }
  const pages = stay.resolvePages(copyRaw, stay.currentLang());
  const dock = document.getElementById("dock");
  dock?.addEventListener("click", (event) => {
    event.preventDefault();
    const offerOpen = ready && !ready.hidden;
    const target = offerOpen ? document.getElementById("offer-yes") : document.getElementById("rate");
    target?.scrollIntoView({ behavior: "smooth", block: offerOpen ? "center" : "start" });
    if (offerOpen) document.getElementById("offer-yes")?.focus({ preventScroll: true });
    else document.querySelector("#rate-form button[type='submit']")?.focus({ preventScroll: true });
  });
  window.addEventListener("scroll", placeDock, { passive: true });
  window.addEventListener("resize", placeDock);

  const preview = params.get("preview");
  if (preview === "1" || preview === "5" || preview === "10") {
    showDone(Number(preview));
    return;
  }

  const yes = document.getElementById("offer-yes");
  const no = document.getElementById("offer-no");

  let priorAfm = "";
  let billing = { document: "receipt", afm: "", name: "", title: "", address: "", error: "" };
  let lookupToken = 0;
  const afmWrap = document.getElementById("bill-afm");
  const afmInput = document.getElementById("buyer-afm");
  const companyEl = document.getElementById("bill-company");

  const paintCompany = () => {
    if (!companyEl) return;
    if (!billing.name) {
      companyEl.hidden = !billing.error;
      companyEl.textContent = billing.error || "";
      return;
    }
    companyEl.hidden = false;
    companyEl.textContent = [billing.name, billing.title, billing.address].filter(Boolean).join("\n");
  };

  const lookupAfm = async () => {
    const afm = afmInput?.value.replace(/\D/g, "") || "";
    billing = { document: "invoice", afm: "", name: "", title: "", address: "", error: "" };
    if (afm.length !== 9) {
      paintCompany();
      return;
    }
    const token = ++lookupToken;
    if (companyEl) {
      companyEl.hidden = false;
      companyEl.textContent = stay.t("afmLooking");
    }
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "afm", afm }),
      });
      const payload = await response.json().catch(() => ({}));
      if (token !== lookupToken) return;
      if (!response.ok || !payload.name) throw new Error(payload.error || stay.t("afmMissing"));
      billing = {
        document: "invoice",
        afm: payload.afm || afm,
        name: payload.name,
        title: payload.title || "",
        address: payload.address || "",
        error: "",
      };
    } catch (err) {
      if (token !== lookupToken) return;
      billing.error = stay.localError(err?.message, "afmDown");
    }
    paintCompany();
  };

  document.querySelectorAll('#ready input[name="bill"]').forEach((input) => {
    input.addEventListener("change", () => {
      const invoice = document.querySelector('#ready input[name="bill"]:checked')?.value === "invoice";
      if (afmWrap) afmWrap.hidden = !invoice;
      if (!invoice) {
        lookupToken += 1;
        billing = { document: "receipt", afm: "", name: "", title: "", address: "", error: "" };
        paintCompany();
        return;
      }
      if (afmInput && !afmInput.value && priorAfm) afmInput.value = priorAfm;
      lookupAfm();
    });
  });
  afmInput?.addEventListener("input", () => {
    afmInput.value = afmInput.value.replace(/\D/g, "").slice(0, 9);
    lookupAfm();
  });

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
    markFunnel("1");
  });

  if (orderCode && !name && !doneId) {
    settleViva(orderCode, String(params.get("t") || ""));
    return;
  }

  if (doneId) confirmDone(doneId);
  else {
    ready.hidden = false;
    render();
    if (paidId) confirmReel(paidId);
    if (params.get("cancelled") === "1") {
      showError(
        stay.t("packNotPaid")
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function withPlace(value) {
    const text = String(value || "").trim();
    const name = property;
    if (!name || !text.includes(name)) return escapeHtml(text);
    const token = "\u0001";
    const safeName = escapeHtml(name);
    const span = `<span class="place">«${safeName}»</span>`;
    return escapeHtml(text)
      .replaceAll(`«${safeName}»`, token)
      .replaceAll(`&quot;${safeName}&quot;`, token)
      .replaceAll(`“${safeName}”`, token)
      .replaceAll(safeName, token)
      .replaceAll(token, span);
  }

  function setText(node, value) {
    if (!node) return;
    const text = String(value || "").trim();
    node.hidden = text.length === 0;
    node.innerHTML = withPlace(text);
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
        item.innerHTML = withPlace(line);
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
    let sampleOverrides = {};
    if (!params.get("draft")) {
      try {
        sampleOverrides = JSON.parse(sessionStorage.getItem("myreels_funnel_samples") || "{}");
      } catch {
        sampleOverrides = {};
      }
    }
    stay.mountWork(work, pageKey, pages.samples, {
      live: !params.get("draft"),
      overrides: sampleOverrides,
    });
  }

  function render() {
    const place = property || stay.t("yourPlace");
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
    const factory = stay.resolvePages("", stay.currentLang())[step === 10 ? "up10" : "up5"];
    const tokens = tokensFor(packNet, extra);
    document.title = `${stay.fillTokens(stay.t("continueFor"), { name: place })} · LuxuryStayReels`;
    ready.classList.toggle("is-five", step === 5);
    setText(kicker, stay.fillTokens(page.kicker, tokens));
    setText(title, stay.fillTokens(page.title, tokens));
    setText(owned, stay.fillTokens(page.owned, tokens));
    setText(lead, stay.fillTokens(page.lead, tokens));
    fillList(perks, page.perks, tokens);
    if (!params.get("preview")) markFunnel(step === 5 ? "5" : "10");

    const billBlock = document.getElementById("offer-bill");
    if (!extra) {
      if (context) {
        context.hidden = false;
        context.textContent = stay.t("upgradeUnavailable");
      }
      if (netNode) netNode.textContent = "";
      if (grossNode) grossNode.textContent = "";
      if (yes) yes.hidden = true;
      if (billBlock) billBlock.hidden = true;
      paintWork(step === 10 ? "up10" : "up5");
      placeDock();
      return;
    }
    if (billBlock) billBlock.hidden = false;
    if (yes) yes.hidden = false;
    setText(context, stay.fillTokens(page.context, tokens));
    if (netNode) netNode.textContent = stay.euro(extra.extraNet);
    if (grossNode) grossNode.textContent = `${stay.euro(extra.extraGross)} ${stay.t("vat")}`;
    if (yes) yes.textContent = stay.fillTokens(page.yes, tokens).trim() || stay.fillTokens(factory.yes, tokens);
    if (no) no.textContent = stay.fillTokens(page.no, tokens).trim() || stay.fillTokens(factory.no, tokens);
    paintWork(step === 10 ? "up10" : "up5");
    placeDock();
  }

  async function confirmReel(id) {
    const order = await readOrder(id);
    if (!order || order.kind !== "reel") {
      showError(stay.t("firstNotPaid"));
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
        stay.t("packNotPaid")
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

  function chosenBill() {
    const invoice = document.querySelector('#ready input[name="bill"]:checked')?.value === "invoice";
    return {
      document: invoice ? "invoice" : "receipt",
      afm: invoice ? afmInput?.value.replace(/\D/g, "") || "" : "",
    };
  }

  async function payUpgrade(count) {
    const errorEl = document.getElementById("form-error");
    if (errorEl) errorEl.hidden = true;
    const choice = chosenBill();
    if (choice.document === "invoice" && (billing.afm !== choice.afm || !billing.name)) {
      showError(billing.error || stay.t("afmInvalid"));
      return;
    }
    if (yes) {
      yes.disabled = true;
      yes.textContent = stay.t("paying");
    }
    if (no) no.disabled = true;
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          kind: "pack",
          pack: count,
          videoId: pageVideo,
          property,
          document: choice.document,
          afm: choice.afm,
          lang: stay.currentLang(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || stay.t("payClosed"));
      }
      window.location.assign(payload.url);
    } catch (err) {
      if (yes) yes.disabled = false;
      if (no) no.disabled = false;
      render();
      showError(stay.localError(err?.message, "payFailed"));
    }
  }

  async function settleViva(code, transactionId) {
    const title = missing.querySelector("h1");
    const text = missing.querySelector("h1 + p");
    const line = missing.querySelector(".banner__line");
    const loader = document.getElementById("wait-loader");
    if (line) line.textContent = stay.t("yoursLine");
    if (text) {
      text.textContent = "";
      text.hidden = true;
    }
    if (loader) loader.hidden = false;
    missing.hidden = false;
    const beatText = () => [
      stay.t("beat1"),
      stay.fillTokens(stay.t("beat2"), { name: property }),
      stay.t("beat3"),
      stay.t("beat4"),
    ];
    let beat = 0;
    let hold = true;
    const showBeat = (index, fade) => {
      beat = index;
      const value = beatText()[index];
      if (!title) return;
      if (!fade) {
        title.innerHTML = withPlace(value);
        return;
      }
      title.classList.add("is-dim");
      window.setTimeout(() => {
        if (!hold || beat !== index) return;
        title.innerHTML = withPlace(value);
        title.classList.remove("is-dim");
      }, 180);
    };
    showBeat(0, false);
    const beatTimer = window.setInterval(() => {
      if (beat >= 3) {
        window.clearInterval(beatTimer);
        return;
      }
      showBeat(beat + 1, true);
    }, 1100);
    const beatsDone = new Promise((resolve) => {
      window.setTimeout(resolve, 4200);
    });
    let last = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const response = await fetch(
          `/api/viva?s=${encodeURIComponent(code)}&t=${encodeURIComponent(transactionId)}`,
          { cache: "no-store" }
        );
        last = await response.json().catch(() => ({}));
        if (response.ok && last.status === "paid") {
          property = stay.cleanName(last.property) || property;
          if (hold && beat === 1 && title && !title.classList.contains("is-dim")) title.innerHTML = withPlace(beatText()[1]);
          break;
        }
        if (response.ok && last.status === "failed") break;
      } catch {
        last = null;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const paid = Boolean(last && last.status === "paid");
    if (paid) await beatsDone;
    hold = false;
    window.clearInterval(beatTimer);
    title?.classList.remove("is-dim");
    if (loader) loader.hidden = true;
    if (!paid) {
      const face = document.getElementById("wait-face");
      if (face) face.hidden = false;
      if (title) title.textContent = stay.t("payUnconfirmed");
      if (text) {
        text.hidden = false;
        text.textContent = last?.status === "failed" ? stay.t("payBack") : stay.t("payRefresh");
      }
      return;
    }
    missing.hidden = true;
    property = stay.cleanName(last.property) || property;
    pageVideo = stay.parseYouTubeId(last.videoId) || pageVideo;
    const paidNet = stay.parseNet(last.net);
    const next5 = stay.parseNet(last.pack5);
    const next10 = stay.parseNet(last.pack10);
    if (paidNet != null) firstNet = paidNet;
    if (next5 != null) pack5 = next5;
    if (next10 != null) pack10 = next10;
    priorAfm = last.document === "invoice" && /^\d{9}$/.test(last.afm || "") ? last.afm : "";
    try {
      const previous = JSON.parse(sessionStorage.getItem("myreels_reel_order") || "{}");
      sessionStorage.setItem(
        "myreels_reel_order",
        JSON.stringify({
          name: last.buyerName || previous.name || "",
          email: previous.email || "",
          phone: previous.phone || "",
          property,
        })
      );
    } catch {
      /* the confirmation still uses the name from the payment */
    }
    if (last.kind === "pack10" || last.kind === "pack5") {
      showDone(last.kind === "pack5" ? 5 : 10);
      return;
    }
    ready.hidden = false;
    render();
  }

  function markFunnel(step) {
    const rank = { 10: 1, 5: 2, 1: 3 };
    if ((rank[funnelSent] || 0) >= rank[step]) return;
    funnelSent = step;
    fetch("/api/stay-skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: pageVideo, property, step: String(step) }),
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
    const doneTitle = stay.fillTokens(pages.done[`${key}Title`], tokens);
    document.title = `${doneTitle} · LuxuryStayReels`;
    setText(title, doneTitle);
    setText(text, stay.fillTokens(pages.done[`${key}Text`], tokens));
    done.hidden = false;
    paintWork(count === 10 ? "done10" : count === 5 ? "done5" : "done1");
    mountRate();
    window.scrollTo(0, 0);
    placeDock();
  }

  function mountRate() {
    const form = document.getElementById("rate-form");
    if (!form) return;
    const videoId = pageVideo;
    const nameInput = document.getElementById("rate-name");
    const propertyInput = document.getElementById("rate-property");
    if (propertyInput && !propertyInput.value) propertyInput.value = property;
    try {
      const order = JSON.parse(sessionStorage.getItem("myreels_reel_order") || "{}");
      if (nameInput && !nameInput.value && order.name) nameInput.value = order.name;
    } catch {
      /* the confirmation still shows the property from the link */
    }
    const finish = (text) => {
      const rate = document.getElementById("rate");
      if (!rate) return;
      rate.replaceChildren();
      const heading = document.createElement("h2");
      heading.textContent = stay.t("thanks");
      const note = document.createElement("p");
      note.className = "rate__thanks";
      note.innerHTML = withPlace(text);
      rate.append(heading, note);
      placeDock();
    };
    if (videoId || property) {
      const query = new URLSearchParams();
      if (videoId) query.set("v", videoId);
      if (property) query.set("property", property);
      fetch(`/api/review?${query}`, { cache: "no-store" })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data?.ok) return;
          if (nameInput && data.buyerName) nameInput.value = data.buyerName;
          if (propertyInput && data.property) propertyInput.value = data.property;
          if (data.reviewed) finish(stay.t("reviewHave"));
        })
        .catch(() => {});
    }
    if (form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    const paintStars = () => {
      const picked = Number(form.querySelector("input[name='stars']:checked")?.value || 0);
      form.querySelectorAll(".stars label").forEach((label) => {
        label.classList.toggle("is-on", Number(label.dataset.star) <= picked);
      });
    };
    form.addEventListener("change", paintStars);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("rate-error");
      const stars = Number(form.querySelector("input[name='stars']:checked")?.value || 0);
      const message = form.message.value.trim();
      if (error) error.hidden = true;
      if (!stars) {
        if (error) {
          error.hidden = false;
          error.textContent = stay.t("pickStarsError");
        }
        return;
      }
      const button = form.querySelector("button");
      if (button) button.disabled = true;
      try {
        const response = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            property: propertyInput?.value || property,
            stars,
            message,
            hideName: false,
            website: form.website.value,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) throw new Error(payload.error || stay.t("notSent"));
        finish(payload.already ? stay.t("reviewHave") : stay.t("reviewSeen"));
      } catch (err) {
        if (button) button.disabled = false;
        if (error) {
          error.hidden = false;
          error.textContent = stay.localError(err?.message, "notSent");
        }
      }
    });
  }

  function placeDock() {
    const dock = document.getElementById("dock");
    if (!dock) return;
    const offerOpen = ready && !ready.hidden;
    const doneOpen = done && !done.hidden;
    const button = offerOpen
      ? document.getElementById("offer-yes")
      : doneOpen
        ? document.querySelector("#rate-form button[type='submit']")
        : null;
    const anchor = offerOpen ? document.getElementById("offer-net") : doneOpen ? document.getElementById("done-title") : null;
    if (!button || button.hidden || !button.textContent.trim() || !anchor || window.innerWidth > 959) {
      dock.hidden = true;
      return;
    }
    dock.textContent = button.textContent.trim();
    dock.classList.toggle("is-five", Boolean(offerOpen && ready.classList.contains("is-five")));
    const priceTop = anchor.getBoundingClientRect().top;
    const box = button.getBoundingClientRect();
    const priceShown = priceTop < window.innerHeight * 0.92;
    const buttonShown = box.top < window.innerHeight - 12 && box.bottom > 48;
    dock.hidden = !(priceShown && !buttonShown);
  }

})();
