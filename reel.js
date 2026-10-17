(() => {
  const stay = window.MyReelsStay;

  const boot = async () => {
  const params = new URLSearchParams(window.location.search);
  const pathStay = (() => {
    try {
      const match = decodeURIComponent(window.location.pathname).match(/^\/(?:luxurystayreels|myairbnbreels)\/(.+?)\/?$/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  })();
  let name = stay.cleanName(pathStay || params.get("name"));
  let videoId = stay.parseYouTubeId(params.get("v"));
  let driveId = stay.parseDriveId(params.get("g"));
  let net = stay.parseNet(params.get("p"));
  let pack5 = stay.parseNet(params.get("p5"));
  let pack10 = stay.parseNet(params.get("p10"));
  let copyRaw = params.get("c") || "";
  let sampleOverrides = {};
  let posterAt = 0;
  if (params.get("m") === "b") document.documentElement.classList.add("is-mobile-b");
  if (!videoId && pathStay) {
    try {
      const response = await fetch(`/api/reel-config?slug=${encodeURIComponent(pathStay)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok && data.videoId) {
        name = stay.cleanName(data.property) || name;
        videoId = stay.parseYouTubeId(data.videoId);
        driveId = stay.parseDriveId(data.driveUrl) || driveId;
        if (stay.parseNet(data.net) != null) net = stay.parseNet(data.net);
        if (stay.parseNet(data.pack5) != null) pack5 = stay.parseNet(data.pack5);
        if (stay.parseNet(data.pack10) != null) pack10 = stay.parseNet(data.pack10);
        if (data.copy) copyRaw = data.copy;
        if (data.samples && typeof data.samples === "object") sampleOverrides = data.samples;
        if (Number(data.posterAt) > 0) posterAt = Math.round(Number(data.posterAt) * 10) / 10;
        if (data.mobile === "b") document.documentElement.classList.add("is-mobile-b");
      }
    } catch {
      /* an older link still carries the video in the query */
    }
  }
  net = net ?? stay.NET;
  pack5 = pack5 ?? stay.PACK_5;
  pack10 = pack10 ?? stay.PACK_10;
  const gross = stay.grossOf(net);
  const netLabel = stay.euro(net);
  const grossLabel = stay.euro(gross);
  const ready = document.getElementById("ready");
  const missing = document.getElementById("missing");

  if (!name || !videoId) {
    missing.hidden = false;
    return;
  }

  const pages = stay.resolvePages(copyRaw);
  const copy = pages.landing;
  const tokens = { name, net: netLabel, gross: grossLabel };
  try {
    sessionStorage.setItem("myreels_funnel_c", copyRaw || "");
    if (!params.get("draft")) sessionStorage.setItem("myreels_funnel_samples", JSON.stringify(sampleOverrides));
  } catch {
    /* the upsell still has the factory text */
  }
  const textOf = (key) => stay.fillTokens(copy[key], tokens).trim();
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const htmlOf = (key) => {
    const marker = "\u0001";
    const filled = stay.fillTokens(copy[key], { ...tokens, name: name ? marker : "" }).trim();
    const safe = escapeHtml(filled);
    if (!name) return safe;
    const quoted = key === "label" ? escapeHtml(name) : `«${escapeHtml(name)}»`;
    const span = `<span class="place">${quoted}</span>`;
    return safe
      .replaceAll(`«${marker}»`, span)
      .replaceAll(`&quot;${marker}&quot;`, span)
      .replaceAll(`“${marker}”`, span)
      .replaceAll(marker, span);
  };
  document.querySelectorAll("[data-copy]").forEach((node) => {
    const html = htmlOf(node.getAttribute("data-copy"));
    node.hidden = html.length === 0;
    node.innerHTML = html;
  });
  const ctaLabel = textOf("cta") || stay.fillTokens(stay.COPY.cta, tokens);
  const buyBtn = document.getElementById("buy-btn");
  const dock = document.getElementById("dock");
  if (buyBtn) buyBtn.textContent = ctaLabel;
  if (dock) {
    dock.textContent = ctaLabel;
    dock.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("buyer-name")?.focus({ preventScroll: true });
    });
    const price = document.querySelector(".amount");
    const placeDock = () => {
      if (!price || !buyBtn || window.innerWidth > 959) {
        dock.hidden = true;
        return;
      }
      const priceTop = price.getBoundingClientRect().top;
      const buy = buyBtn.getBoundingClientRect();
      const priceShown = priceTop < window.innerHeight * 0.92;
      const buyShown = buy.top < window.innerHeight - 12 && buy.bottom > 48;
      dock.hidden = !(priceShown && !buyShown);
    };
    placeDock();
    window.addEventListener("scroll", placeDock, { passive: true });
    window.addEventListener("resize", placeDock);
  }
  document.title = `${textOf("headline") || name} · LuxuryStayReels`;
  document.querySelectorAll("[data-stay-gross]").forEach((node) => {
    node.textContent = grossLabel;
  });
  document.querySelectorAll("[data-stay-net]").forEach((node) => {
    node.textContent = netLabel;
  });

  const soundBtn = document.getElementById("sound-btn");
  const frame = document.getElementById("frame");
  const frameHit = document.getElementById("frame-hit");
  const poster = document.getElementById("frame-poster");
  if (poster) poster.src = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  let ytPlayer = null;
  let wantPlay = false;
  let soundOn = true;
  let armPoster = posterAt > 0;
  let pinPoster = 0;

  const applyHeroSound = (player) => {
    const target = player || ytPlayer;
    if (!target || typeof target.unMute !== "function") return;
    if (soundOn) {
      target.unMute();
      target.setVolume(100);
    } else {
      target.mute();
    }
  };

  const setHeroPlaying = (playing) => {
    frame?.classList.toggle("is-playing", playing);
    if (playing) frame?.classList.add("is-started");
    frameHit?.setAttribute("aria-label", playing ? "Σταμάτα το Reel" : "Παίξε το Reel");
  };

  const pauseHero = () => {
    wantPlay = false;
    setHeroPlaying(false);
    if (ytPlayer && typeof ytPlayer.pauseVideo === "function") ytPlayer.pauseVideo();
  };

  document.addEventListener("myreels-work-play", pauseHero);

  let started = false;
  const mountPlayer = () => {
    if (started || !window.YT || !window.YT.Player) return;
    started = true;
    ytPlayer = new YT.Player("player", {
      host: "https://www.youtube-nocookie.com",
      videoId,
      playerVars: {
        autoplay: 0,
        mute: 0,
        loop: 1,
        playlist: videoId,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          if (wantPlay) {
            applyHeroSound(event.target);
            event.target.playVideo();
            return;
          }
          if (!armPoster) return;
          event.target.mute();
          event.target.seekTo(posterAt, true);
          event.target.playVideo();
          window.clearInterval(pinPoster);
          pinPoster = window.setInterval(() => {
            if (!armPoster || wantPlay || !ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
            const time = ytPlayer.getCurrentTime();
            if (time > posterAt + 0.08 || time + 0.05 < posterAt) ytPlayer.seekTo(posterAt, true);
          }, 80);
        },
        onStateChange: (event) => {
          const state = event.data;
          if (armPoster && !wantPlay) {
            if (state === window.YT.PlayerState.PLAYING) frame?.classList.add("is-cued");
            return;
          }
          const playing = state === window.YT.PlayerState.PLAYING;
          if (playing) {
            document.dispatchEvent(new CustomEvent("myreels-hero-play"));
            setHeroPlaying(true);
            return;
          }
          if (wantPlay) return;
          if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) setHeroPlaying(false);
        },
      },
    });
  };

  const youtubeAllowed = () => !window.MyReelsCookies || window.MyReelsCookies.choice() === "all";

  const loadYoutubeApi = () => {
    if (!youtubeAllowed()) return;
    if (window.YT && window.YT.Player) {
      mountPlayer();
      return;
    }
    if (document.querySelector('script[src*="iframe_api"]')) return;
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") previousReady();
      mountPlayer();
    };
    const api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);
  };

  document.addEventListener("myreels-cookies", loadYoutubeApi);
  loadYoutubeApi();

  const SOUND_ON =
    "M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15zM14 4.23v2.06a6 6 0 0 1 0 11.42v2.06a8 8 0 0 0 0-15.54z";
  const SOUND_OFF =
    "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H4v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.9 8.9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z";

  soundBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!ytPlayer || typeof ytPlayer.unMute !== "function") return;
    soundOn = !soundOn;
    applyHeroSound();
    if (soundOn) ytPlayer.playVideo();
    soundBtn.querySelector("#sound-path")?.setAttribute("d", soundOn ? SOUND_ON : SOUND_OFF);
    soundBtn.setAttribute("aria-label", soundOn ? "Κλείσε τον ήχο" : "Άνοιξε τον ήχο");
  });

  frameHit?.addEventListener("click", () => {
    const playing = frame?.classList.contains("is-playing");
    if (playing) {
      pauseHero();
      return;
    }
    if (!youtubeAllowed()) {
      window.MyReelsCookies?.ask();
      return;
    }
    wantPlay = true;
    armPoster = false;
    window.clearInterval(pinPoster);
    if (!ytPlayer || typeof ytPlayer.playVideo !== "function") return;
    armPoster = false;
    ytPlayer.seekTo(0, true);
    applyHeroSound();
    ytPlayer.playVideo();
  });

  const propertyInput = document.getElementById("buyer-property");
  if (propertyInput && !propertyInput.value) propertyInput.value = name;

  ready.hidden = false;
  stay.mountWork(document.getElementById("work"), "landing", pages.samples, {
    live: !params.get("draft"),
    overrides: params.get("draft") ? null : sampleOverrides,
  });

  const form = document.getElementById("order");
  const errorEl = document.getElementById("form-error");
  const afmWrap = document.getElementById("bill-afm");
  const afmInput = document.getElementById("buyer-afm");
  const companyEl = document.getElementById("bill-company");
  let billing = { document: "receipt", afm: "", name: "", title: "", address: "", error: "" };
  let lookupToken = 0;

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
      companyEl.textContent = "Ψάχνω τα στοιχεία…";
    }
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "afm", afm }),
      });
      const payload = await response.json().catch(() => ({}));
      if (token !== lookupToken) return;
      if (!response.ok || !payload.name) throw new Error(payload.error || "Δεν βρέθηκαν στοιχεία για αυτό το ΑΦΜ.");
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
      billing.error = err?.message || "Η αναζήτηση ΑΦΜ δεν απάντησε. Δοκίμασε ξανά.";
    }
    paintCompany();
  };

  form.querySelectorAll('input[name="bill"]').forEach((input) => {
    input.addEventListener("change", () => {
      const invoice = form.querySelector('input[name="bill"]:checked')?.value === "invoice";
      if (afmWrap) afmWrap.hidden = !invoice;
      if (!invoice) {
        lookupToken += 1;
        billing = { document: "receipt", afm: "", name: "", title: "", address: "", error: "" };
        paintCompany();
        return;
      }
      lookupAfm();
    });
  });
  afmInput?.addEventListener("input", () => {
    afmInput.value = afmInput.value.replace(/\D/g, "").slice(0, 9);
    lookupAfm();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const buyer = document.getElementById("buyer-name").value.trim();
    const property = propertyInput?.value.trim() || "";
    const email = document.getElementById("buyer-email").value.trim();
    const phone = document.getElementById("buyer-phone").value.trim();
    const accepted = document.getElementById("buyer-privacy")?.checked === true;
    const trap = form.querySelector(".hp")?.value.trim();
    if (trap) return;
    if (!accepted) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Τσέκαρε ότι αποδέχεσαι την Πολιτική Απορρήτου.";
      }
      return;
    }
    const invoice = form.querySelector('input[name="bill"]:checked')?.value === "invoice";
    const afm = afmInput?.value.replace(/\D/g, "") || "";
    if (invoice && (billing.afm !== afm || !billing.name)) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = billing.error || "Βάλε ένα σωστό ΑΦΜ για να βρεθούν τα στοιχεία του τιμολογίου.";
      }
      return;
    }
    if (!buyer || !property || !email || phone.replace(/\D/g, "").length < 10) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = phone.replace(/\D/g, "").length < 10
          ? "Γράψε ένα τηλέφωνο."
          : "Συμπλήρωσε όλα τα πεδία.";
      }
      return;
    }

    buyBtn.disabled = true;
    buyBtn.textContent = "Μετάβαση στην πληρωμή…";

    try {
      sessionStorage.setItem(
        "myreels_reel_order",
        JSON.stringify({ name: buyer, email, phone, property })
      );
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          kind: "reel",
          videoId,
          property,
          buyerName: buyer,
          email,
          phone,
          acceptPrivacy: true,
          document: invoice ? "invoice" : "receipt",
          afm: invoice ? afm : "",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Η πληρωμή δεν άνοιξε.");
      }
      window.location.assign(payload.url);
    } catch (err) {
      buyBtn.disabled = false;
      buyBtn.textContent = ctaLabel;
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = err?.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
      }
    }
  });
  };

  boot();
})();
