(() => {
  const stay = window.MyReelsStay;
  const params = new URLSearchParams(window.location.search);
  const pathStay = (() => {
    try {
      const match = decodeURIComponent(window.location.pathname).match(/^\/myairbnbreels\/(.+?)\/?$/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  })();
  const name = stay.cleanName(pathStay || params.get("name"));
  const videoId = stay.parseYouTubeId(params.get("v"));
  const driveId = stay.parseDriveId(params.get("g"));
  const net = stay.parseNet(params.get("p")) ?? stay.NET;
  const pack5 = stay.parseNet(params.get("p5")) ?? stay.PACK_5;
  const pack10 = stay.parseNet(params.get("p10")) ?? stay.PACK_10;
  const gross = stay.grossOf(net);
  const netLabel = stay.euro(net);
  const grossLabel = stay.euro(gross);
  const ready = document.getElementById("ready");
  const missing = document.getElementById("missing");

  if (!name || !videoId) {
    missing.hidden = false;
    return;
  }

  const pages = stay.resolvePages(params.get("c"));
  const copy = pages.landing;
  const tokens = { name, net: netLabel, gross: grossLabel };
  try {
    sessionStorage.setItem("myreels_funnel_c", params.get("c") || "");
  } catch {
    /* the upsell still has the factory text */
  }
  const textOf = (key) => stay.fillTokens(copy[key], tokens).trim();
  document.querySelectorAll("[data-copy]").forEach((node) => {
    const text = textOf(node.getAttribute("data-copy"));
    node.hidden = text.length === 0;
    node.textContent = text;
  });
  const ctaLabel = textOf("cta") || stay.fillTokens(stay.COPY.cta, tokens);
  const buyBtn = document.getElementById("buy-btn");
  if (buyBtn) buyBtn.textContent = ctaLabel;
  document.title = `${textOf("headline") || name} · myairbnbreels`;
  document.querySelectorAll("[data-stay-gross]").forEach((node) => {
    node.textContent = grossLabel;
  });
  document.querySelectorAll("[data-stay-net]").forEach((node) => {
    node.textContent = netLabel;
  });

  const soundBtn = document.getElementById("sound-btn");
  let ytPlayer = null;

  let started = false;
  const mountPlayer = () => {
    if (started || !window.YT || !window.YT.Player) return;
    started = true;
    ytPlayer = new YT.Player("player", {
      videoId,
      playerVars: {
        autoplay: 1,
        mute: 1,
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
          event.target.mute();
          event.target.playVideo();
        },
      },
    });
  };

  const previousReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof previousReady === "function") previousReady();
    mountPlayer();
  };

  if (window.YT && window.YT.Player) mountPlayer();
  else {
    const api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);
  }

  const SOUND_ON =
    "M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15zM14 4.23v2.06a6 6 0 0 1 0 11.42v2.06a8 8 0 0 0 0-15.54z";
  const SOUND_OFF =
    "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H4v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.9 8.9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z";

  let soundOn = false;
  soundBtn?.addEventListener("click", () => {
    if (!ytPlayer || typeof ytPlayer.unMute !== "function") return;
    soundOn = !soundOn;
    if (soundOn) {
      ytPlayer.unMute();
      ytPlayer.setVolume(100);
      ytPlayer.playVideo();
    } else {
      ytPlayer.mute();
    }
    soundBtn.classList.add("sound--mini");
    soundBtn.querySelector("#sound-path")?.setAttribute("d", soundOn ? SOUND_ON : SOUND_OFF);
    soundBtn.setAttribute("aria-label", soundOn ? "Κλείσε τον ήχο" : "Άνοιξε τον ήχο");
  });

  const propertyInput = document.getElementById("buyer-property");
  if (propertyInput && !propertyInput.value) propertyInput.value = name;

  ready.hidden = false;
  stay.mountWork(document.getElementById("work"), "landing", pages.samples);

  const form = document.getElementById("order");
  const errorEl = document.getElementById("form-error");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const buyer = document.getElementById("buyer-name").value.trim();
    const property = propertyInput?.value.trim() || "";
    const email = document.getElementById("buyer-email").value.trim();
    const phone = document.getElementById("buyer-phone").value.trim();
    const trap = form.querySelector(".hp")?.value.trim();
    if (trap || !buyer || !property || !email || phone.replace(/\D/g, "").length < 10) {
      if (errorEl && phone.replace(/\D/g, "").length < 10) {
        errorEl.hidden = false;
        errorEl.textContent = "Γράψε ένα τηλέφωνο.";
      }
      return;
    }

    buyBtn.disabled = true;
    buyBtn.textContent = "Στέλνουμε την παραγγελία…";

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: buyer,
          business: property,
          email,
          phone,
          videoId,
          services: ["stay"],
          source: "reel",
          priceNet: net,
          driveUrl: stay.driveFileUrl(driveId),
          notes: `YouTube: https://www.youtube.com/watch?v=${videoId}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Η παραγγελία δεν στάλθηκε.");
      }
      sessionStorage.setItem(
        "myreels_reel_order",
        JSON.stringify({ name: buyer, email, phone, property })
      );
      window.location.assign(
        stay.buildUpsellUrl(window.location.origin, property, videoId, {
          p: net,
          p5: pack5,
          p10: pack10,
          copy: pages,
        })
      );
    } catch (err) {
      buyBtn.disabled = false;
      buyBtn.textContent = ctaLabel;
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = err?.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
      }
    }
  });
})();
