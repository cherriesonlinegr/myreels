/* Shared helpers for accommodation Reel landings. */
window.MyReelsStay = (() => {
  const NET = 40;
  const PACK_5 = 170;
  const PACK_10 = 300;
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
    { key: "pitch", label: "Κείμενο μετά το βίντεο", rows: 4, max: 600 },
    { key: "priceTitle", label: "Τίτλος τιμής", rows: 2, max: 80 },
    { key: "priceYes", label: "Γραμμή κάτω από την τιμή", rows: 2, max: 160 },
    { key: "priceNote", label: "Εξήγηση τιμής", rows: 4, max: 600 },
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
      "Συμπλήρωσε τα στοιχεία σου. Μόλις λάβουμε την παραγγελία, σου στέλνουμε το τελικό αρχείο.",
    cta: "Θέλω το Reel — {net}",
    micro: "Χωρίς ραντεβού. Χωρίς γύρισμα. Χωρίς μπλέξιμο.",
    ps: "Υ.Γ. Ειλικρινά, αυτό το βίντεο δεν έπρεπε να στο δίνουμε σε αυτή την τιμή. Αν δεν το θέλεις, κάνε πως δεν το είδες. Θα κάνουμε το ίδιο.",
  };

  const cleanCopyValue = (value, max) =>
    String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, max);

  const normalizeCopy = (input) => {
    const source = input && typeof input === "object" ? input : null;
    const copy = {};
    COPY_FIELDS.forEach((field) => {
      const has = source && Object.prototype.hasOwnProperty.call(source, field.key);
      copy[field.key] = has ? cleanCopyValue(source[field.key], field.max) : COPY[field.key];
    });
    return copy;
  };

  const encodeCopy = (input) => {
    if (input == null) return "";
    const copy = normalizeCopy(input);
    const diff = {};
    COPY_FIELDS.forEach((field) => {
      if (copy[field.key] !== COPY[field.key]) diff[field.key] = copy[field.key];
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
      if (!data || typeof data !== "object") return {};
      const diff = {};
      COPY_FIELDS.forEach((field) => {
        if (typeof data[field.key] === "string") {
          diff[field.key] = cleanCopyValue(data[field.key], field.max);
        }
      });
      return diff;
    } catch {
      return {};
    }
  };

  const resolveCopy = (raw) => normalizeCopy(decodeCopy(raw));

  const fillTokens = (template, vars) =>
    String(template ?? "")
      .replaceAll("{name}", vars?.name || "")
      .replaceAll("{net}", vars?.net || "")
      .replaceAll("{gross}", vars?.gross || "");

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
    COPY,
    normalizeCopy,
    encodeCopy,
    resolveCopy,
    fillTokens,
    buildLandingUrl,
    buildUpsellUrl,
  };
})();
