/* Shared helpers for accommodation Reel landings. */
window.MyReelsStay = (() => {
  const NET = 40;
  const PACK_5 = 170;
  const PACK_10 = 350;
  const VAT_RATE = 0.24;

  const parseNet = (value) => {
    if (value == null || String(value).trim() === "") return null;
    const amount = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return null;
    return Math.round(amount * 100) / 100;
  };

  const grossOf = (net) => Math.round(Number(net) * (1 + VAT_RATE) * 100) / 100;

  const euro = (amount) => {
    const cents = Math.round(Number(amount) * 100);
    const hasDecimals = cents % 100 !== 0;
    const formatted = new Intl.NumberFormat("el-GR", {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(amount);
    return `${formatted}€`;
  };

  const parseYouTubeId = (input) => {
    const raw = String(input || "").trim();
    if (!raw) return "";
    if (/^[\w-]{11}$/.test(raw)) return raw;

    let url;
    try {
      url = new URL(raw);
    } catch {
      return "";
    }

    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const fromPath = () => {
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((part) => ["embed", "shorts", "live", "v"].includes(part));
      const id = idx >= 0 ? parts[idx + 1] : "";
      return id && /^[\w-]{11}$/.test(id) ? id : "";
    };

    if (host === "youtu.be") {
      const id = (url.pathname.split("/").filter(Boolean)[0] || "").split("?")[0];
      return /^[\w-]{11}$/.test(id) ? id : "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const v = url.searchParams.get("v") || "";
      if (/^[\w-]{11}$/.test(v)) return v;
      return fromPath();
    }

    return "";
  };

  const parseDriveId = (input) => {
    const raw = String(input || "").trim();
    if (!raw) return "";
    if (/^[\w-]{10,80}$/.test(raw)) return raw;

    let url;
    try {
      url = new URL(raw);
    } catch {
      return "";
    }

    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "drive.google.com" && host !== "docs.google.com") return "";

    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.indexOf("d");
    const fromPath = marker >= 0 ? parts[marker + 1] || "" : "";
    if (/^[\w-]{10,80}$/.test(fromPath)) return fromPath;

    const fromQuery = url.searchParams.get("id") || "";
    return /^[\w-]{10,80}$/.test(fromQuery) ? fromQuery : "";
  };

  const driveFileUrl = (id) => {
    const fileId = parseDriveId(id);
    return fileId ? `https://drive.google.com/file/d/${fileId}/view` : "";
  };

  const cleanName = (value) =>
    String(value || "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

  const COPY_FIELDS = [
    { key: "label", label: "Ετικέτα", rows: 2, max: 120 },
    { key: "headline", label: "Τίτλος", rows: 2, max: 180 },
    { key: "sub", label: "Υπότιτλος", rows: 3, max: 400 },
    { key: "pitchTitle", label: "Τίτλος μετά το βίντεο", rows: 2, max: 180 },
    { key: "pitch", label: "Κείμενο μετά το βίντεο", rows: 4, max: 600, tall: true },
    { key: "priceTitle", label: "Τίτλος τιμής", rows: 2, max: 80 },
    { key: "priceYes", label: "Γραμμή κάτω από την τιμή", rows: 2, max: 160 },
    { key: "priceNote", label: "Εξήγηση τιμής", rows: 4, max: 600, tall: true },
    { key: "formTitle", label: "Τίτλος φόρμας", rows: 2, max: 120 },
    { key: "formSub", label: "Κείμενο φόρμας", rows: 3, max: 400 },
    { key: "cta", label: "Κουμπί", rows: 2, max: 140 },
    { key: "micro", label: "Μικρό κείμενο", rows: 2, max: 240 },
    { key: "ps", label: "Υστερόγραφο", rows: 3, max: 400 },
  ];

  const COPY = {
    label: "Για το {name}",
    headline: "Το Reel του {name} είναι ήδη έτοιμο.",
    sub: "Το φτιάξαμε από τις φωτογραφίες που έχεις ήδη online. Δεν χρειάστηκε γύρισμα. Δεν χρειάστηκε να κάνεις τίποτα.",
    pitchTitle: "Και το καλύτερο; Δεν χρειάστηκε να το τραβήξουμε.",
    pitch:
      "Πήραμε τις φωτογραφίες του καταλύματός σου και δημιουργήσαμε ένα Reel όπου ένα μοντέλο κινείται μέσα στον χώρο. Εσύ δεν χρειάστηκε να κανονίσεις γύρισμα, να εμφανιστείς στην κάμερα ή να τραβήξεις καινούργιο υλικό.",
    priceTitle: "Και πόσο;",
    priceYes: "Ναι. Για ολόκληρο το Reel.",
    priceNote:
      "Δεν είναι έκπτωση από κάποια «αρχική τιμή». Δεν υπάρχει κάποιο κόλπο. Το φτιάξαμε ήδη για το κατάλυμά σου και θέλουμε να δεις στην πράξη τι μπορούμε να κάνουμε. Οπότε ναι, το δίνουμε φτηνά. Επίτηδες.",
    formTitle: "Το θέλεις; Πάρε το.",
    formSub:
      "Συμπλήρωσε τα στοιχεία σου και πλήρωσε με κάρτα. Μόλις ολοκληρωθεί η πληρωμή, σου στέλνουμε το τελικό αρχείο.",
    cta: "Θέλω το Reel — {net}",
    micro: "Χωρίς ραντεβού. Χωρίς γύρισμα. Χωρίς μπλέξιμο.",
    ps: "Υ.Γ. Ειλικρινά, αυτό το βίντεο δεν έπρεπε να στο δίνουμε σε αυτή την τιμή. Αν δεν το θέλεις, κάνε πως δεν το είδες. Θα κάνουμε το ίδιο.",
  };

  const UP_FIELDS = [
    { key: "kicker", label: "Γραμμή στο banner", rows: 2, max: 140 },
    { key: "title", label: "Τίτλος", rows: 2, max: 180 },
    { key: "owned", label: "Γραμμή από κάτω", rows: 2, max: 180 },
    { key: "lead", label: "Κείμενο", rows: 4, max: 500, tall: true },
    { key: "perks", label: "Σημεία, ένα σε κάθε γραμμή", rows: 5, max: 800, tall: true },
    { key: "context", label: "Γραμμή τιμής", rows: 3, max: 400 },
    { key: "yes", label: "Κουμπί", rows: 2, max: 180 },
    { key: "no", label: "Όχι", rows: 2, max: 180 },
  ];

  const UP10 = {
    kicker: "Το πρώτο Reel είναι δικό σου",
    title: "Αφού φτιάξαμε το πρώτο, γιατί να σταματήσουμε εκεί;",
    owned: "Το Reel για το {name} είναι δικό σου.",
    lead: "Μπορούμε να ετοιμάσουμε συνολικά 10 Reels για το κατάλυμά σου και να αναλάβουμε τα social για τους επόμενους 2 μήνες.",
    perks: [
      "10 Reels συνολικά, μαζί με αυτό που αγόρασες.",
      "Πλήρης διαχείριση των social για 2 μήνες.",
      "Γράφουμε τα posts και τα hashtags, και τα προγραμματίζουμε σε Instagram, Facebook και TikTok.",
      "Περίπου μία ανάρτηση κάθε 2–3 μέρες.",
    ].join("\n"),
    context: "Το πακέτο είναι {pack} + ΦΠΑ. Έχεις ήδη πληρώσει {net} + ΦΠΑ. Πληρώνεις τώρα τη διαφορά.",
    yes: "Ναι, θέλω τα 10 και τη διαχείριση — {extra}",
    no: "Όχι τώρα. Συνεχίζω μόνο με το Reel που αγόρασα.",
  };

  const UP5 = {
    kicker: "Μια πιο μικρή επιλογή",
    title: "Θες να έχεις 5 Reels έτοιμα;",
    owned: "Το Reel για το {name} είναι δικό σου.",
    lead: "Κράτα το πρώτο Reel και πρόσθεσε άλλα τέσσερα. Συνολικά πέντε βίντεο για το κατάλυμά σου, χωρίς νέο γύρισμα και χωρίς προγραμματισμό αναρτήσεων.",
    perks: [
      "5 Reels συνολικά, μαζί με αυτό που αγόρασες.",
      "Περισσότερες πλευρές του χώρου, από τις φωτογραφίες που έχεις ήδη.",
      "Η διαχείριση των social για 2 μήνες είναι μόνο στο πακέτο των 10.",
    ].join("\n"),
    context: "Το πακέτο είναι {pack} + ΦΠΑ. Έχεις ήδη πληρώσει {net} + ΦΠΑ. Πληρώνεις τώρα τη διαφορά.",
    yes: "Ναι, θέλω τα 5 — {extra}",
    no: "Όχι, μένω μόνο στο πρώτο Reel.",
  };

  const DONE_FIELDS = [
    { key: "tenTitle", label: "Τίτλος", rows: 2, max: 160, group: "10 Reels" },
    { key: "tenText", label: "Κείμενο", rows: 4, max: 500, tall: true },
    { key: "fiveTitle", label: "Τίτλος", rows: 2, max: 160, group: "5 Reels" },
    { key: "fiveText", label: "Κείμενο", rows: 4, max: 500, tall: true },
    { key: "oneTitle", label: "Τίτλος", rows: 2, max: 160, group: "Μόνο το 1ο Reel" },
    { key: "oneText", label: "Κείμενο", rows: 4, max: 500, tall: true },
  ];

  const DONE = {
    tenTitle: "Έχεις πλέον 10 Reels.",
    tenText:
      "Η αναβάθμιση ολοκληρώθηκε για το «{name}». Συνολικά 10 Reels, και πλήρης διαχείριση των social για 2 μήνες: posts, hashtags και προγραμματισμός σε Instagram, Facebook και TikTok. Δεν έχει ξεκινήσει ακόμα.",
    fiveTitle: "Έχεις πλέον 5 Reels.",
    fiveText:
      "Η αναβάθμιση ολοκληρώθηκε για το «{name}». Συνολικά 5 Reels. Αυτό το πακέτο δεν περιλαμβάνει προγραμματισμό αναρτήσεων. Σου στέλνουμε τα αρχεία.",
    oneTitle: "Η παραγγελία σου ολοκληρώθηκε.",
    oneText: "Το Reel για το «{name}» είναι δικό σου. Σου στέλνουμε το αρχείο. Δεν χρειάζεται να κάνεις κάτι άλλο.",
  };

  const sampleFields = [
    { key: "title", label: "Τίτλος", rows: 2, max: 120 },
    { key: "lead", label: "Υπότιτλος", rows: 2, max: 240 },
  ];
  const SAMPLES = {
    title: "Δες τι κάνουμε.",
    lead: "Εννέα Reels, από εννέα καταλύματα.",
  };
  for (let index = 1; index <= 9; index += 1) {
    sampleFields.push({ key: `n${index}`, label: `Όνομα ${index}`, kind: "line", max: 80 });
    sampleFields.push({ key: `v${index}`, label: `YouTube ${index}`, kind: "line", max: 200 });
    SAMPLES[`n${index}`] = `Δείγμα ${index}`;
    SAMPLES[`v${index}`] = "";
  }

  const COPY_PAGES = [
    { id: "landing", label: "Landing", fields: COPY_FIELDS, copy: COPY },
    { id: "up10", label: "10 Reels", fields: UP_FIELDS, copy: UP10 },
    { id: "up5", label: "5 Reels", fields: UP_FIELDS, copy: UP5 },
    { id: "done", label: "Επιβεβαίωση", fields: DONE_FIELDS, copy: DONE },
    { id: "samples", label: "Δείγματα", fields: sampleFields, copy: SAMPLES },
  ];

  const cleanCopyValue = (value, max) =>
    String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, max);

  const pageById = (id) => COPY_PAGES.find((page) => page.id === id);

  const normalizePage = (page, source) => {
    const copy = {};
    page.fields.forEach((field) => {
      const has = source && Object.prototype.hasOwnProperty.call(source, field.key);
      copy[field.key] = has ? cleanCopyValue(source[field.key], field.max) : page.copy[field.key];
    });
    return copy;
  };

  const normalizeCopy = (input) => normalizePage(pageById("landing"), input);

  const normalizePages = (input) => {
    const source = input && typeof input === "object" ? input : null;
    const nested = source && COPY_PAGES.some((page) => source[page.id] && typeof source[page.id] === "object");
    const pages = {};
    COPY_PAGES.forEach((page) => {
      const pageSource = nested ? source[page.id] : page.id === "landing" ? source : null;
      pages[page.id] = normalizePage(page, pageSource);
    });
    return pages;
  };

  const encodeCopy = (input) => {
    if (input == null) return "";
    const pages = normalizePages(input);
    const diff = {};
    COPY_PAGES.forEach((page) => {
      const pageDiff = {};
      page.fields.forEach((field) => {
        if (pages[page.id][field.key] !== page.copy[field.key]) pageDiff[field.key] = pages[page.id][field.key];
      });
      if (Object.keys(pageDiff).length) diff[page.id] = pageDiff;
    });
    if (!Object.keys(diff).length) return "";
    const bytes = new TextEncoder().encode(JSON.stringify(diff));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const decodeCopy = (raw) => {
    if (!raw) return {};
    try {
      const b64 = String(raw).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      const binary = atob(b64 + pad);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      return data;
    } catch {
      return {};
    }
  };

  const resolvePages = (raw) => normalizePages(decodeCopy(raw));
  const resolveCopy = (raw) => resolvePages(raw).landing;

  const fillTokens = (template, vars) => {
    let text = String(template ?? "");
    const name = vars?.name || "";
    if (!name) {
      text = text.replaceAll(" για το «{name}»", "").replaceAll(" για το {name}", "");
    }
    return text
      .replaceAll("{name}", name)
      .replaceAll("{net}", vars?.net || "")
      .replaceAll("{gross}", vars?.gross || "")
      .replaceAll("{pack}", vars?.pack || "")
      .replaceAll("{extra}", vars?.extra || "")
      .replaceAll("{extraGross}", vars?.extraGross || "");
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const WORK_ORDER = {
    landing: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    up10: [3, 6, 0, 4, 7, 1, 5, 8, 2],
    up5: [8, 5, 2, 7, 4, 1, 6, 3, 0],
    done10: [1, 4, 7, 2, 5, 8, 0, 3, 6],
    done5: [2, 5, 8, 0, 3, 6, 1, 4, 7],
    done1: [6, 1, 4, 8, 3, 0, 7, 2, 5],
  };

  const workItems = (samples) => {
    const items = [];
    for (let index = 1; index <= 9; index += 1) {
      items.push({
        name: String(samples?.[`n${index}`] || "").trim(),
        videoId: parseYouTubeId(samples?.[`v${index}`] || ""),
      });
    }
    return items;
  };

  const workFace = (item) => {
    if (!item.videoId) {
      return `<div class="reel-tile__face reel-tile__face--empty" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="13" fill="#FF5A5F"/><path fill="#fff" d="M9 19.2 20 10l11 9.2V30.2c0 1.1-.9 2-2 2H11c-1.1 0-2-.9-2-2V19.2z"/><path fill="#FF5A5F" d="M17.2 32.2v-5.4a2.8 2.8 0 0 1 5.6 0v5.4"/></svg></div>`;
    }
    return `<button type="button" class="reel-tile__face" data-work-video="${escapeHtml(item.videoId)}" aria-label="Παίξε το δείγμα ${escapeHtml(item.name)}"><img src="https://i.ytimg.com/vi/${escapeHtml(item.videoId)}/hqdefault.jpg" alt="" /><span class="reel-tile__badge" aria-hidden="true"></span></button>`;
  };

  const mountWork = (container, pageKey, samples) => {
    if (!container) return;
    const order = WORK_ORDER[pageKey] || WORK_ORDER.landing;
    const items = workItems(samples);
    const title = fillTokens(samples?.title, {}).trim();
    const lead = fillTokens(samples?.lead, {}).trim();
    const tiles = order
      .map((index) => items[index])
      .filter(Boolean)
      .map(
        (item) =>
          `<figure class="reel-tile" data-work-id="${escapeHtml(item.videoId)}" data-work-name="${escapeHtml(item.name)}">${workFace(item)}<figcaption>${escapeHtml(item.name)}</figcaption></figure>`
      )
      .join("");
    container.innerHTML = `${title ? `<h2 class="work__title">${escapeHtml(title)}</h2>` : ""}${lead ? `<p class="work__lead">${escapeHtml(lead)}</p>` : ""}<div class="work__grid">${tiles}</div>`;
    container.hidden = !title && !lead && !tiles;
    if (container.dataset.workBound === "1") return;
    container.dataset.workBound = "1";
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-work-video]");
      if (!button || !container.contains(button)) return;
      const figure = button.closest("figure");
      const videoId = button.getAttribute("data-work-video");
      if (!figure || !videoId) return;
      container.querySelectorAll(".reel-tile__frame").forEach((frame) => {
        const host = frame.closest("figure");
        if (!host || host === figure) return;
        const id = host.getAttribute("data-work-id") || "";
        const name = host.getAttribute("data-work-name") || "";
        frame.replaceWith(document.createRange().createContextualFragment(workFace({ videoId: id, name })).firstChild);
      });
      const frame = document.createElement("div");
      frame.className = "reel-tile__face reel-tile__frame";
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(videoId)}&controls=0&modestbranding=1&rel=0&playsinline=1`;
      iframe.title = figure.getAttribute("data-work-name") || "Δείγμα";
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.setAttribute("allowfullscreen", "");
      frame.appendChild(iframe);
      button.replaceWith(frame);
    });
  };

  const packNet = (value, fallback) => parseNet(value) ?? fallback;

  const stayPathName = (value) => cleanName(value).replace(/[\\/]/g, "");

  const buildLandingUrl = (origin, name, videoId, net, copy, packs) => {
    const url = new URL(origin);
    url.pathname = `/myairbnbreels/${stayPathName(name)}`;
    url.searchParams.set("v", videoId);
    url.searchParams.set("p", String(parseNet(net) ?? NET));
    url.searchParams.set("p5", String(packNet(packs?.p5, PACK_5)));
    url.searchParams.set("p10", String(packNet(packs?.p10, PACK_10)));
    const driveId = parseDriveId(packs?.drive);
    if (driveId) url.searchParams.set("g", driveId);
    const encoded = encodeCopy(copy);
    if (encoded) url.searchParams.set("c", encoded);
    return url.toString();
  };

  const buildUpsellUrl = (origin, name, videoId, packs) => {
    const url = new URL("/upsell", origin);
    url.searchParams.set("name", cleanName(name));
    if (videoId) url.searchParams.set("v", videoId);
    url.searchParams.set("p", String(packNet(packs?.p, NET)));
    url.searchParams.set("p5", String(packNet(packs?.p5, PACK_5)));
    url.searchParams.set("p10", String(packNet(packs?.p10, PACK_10)));
    if (packs?.step) url.searchParams.set("step", String(packs.step));
    if (packs?.preview) url.searchParams.set("preview", String(packs.preview));
    const encoded = encodeCopy(packs?.copy);
    if (encoded) url.searchParams.set("c", encoded);
    return url.toString();
  };

  return {
    NET,
    PACK_5,
    PACK_10,
    VAT_RATE,
    GROSS: grossOf(NET),
    euro,
    parseNet,
    grossOf,
    parseYouTubeId,
    parseDriveId,
    driveFileUrl,
    cleanName,
    COPY_FIELDS,
    COPY_PAGES,
    COPY,
    normalizeCopy,
    normalizePages,
    encodeCopy,
    resolveCopy,
    resolvePages,
    fillTokens,
    mountWork,
    buildLandingUrl,
    buildUpsellUrl,
  };
})();
