/* Shared helpers for accommodation Reel landings. */
window.MyReelsStay = (() => {
  const NET = 60;
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

  const cleanName = (value) =>
    String(value || "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

  const buildLandingUrl = (origin, name, videoId, net) => {
    const url = new URL("/reel", origin);
    url.searchParams.set("name", cleanName(name));
    url.searchParams.set("v", videoId);
    url.searchParams.set("p", String(parseNet(net) ?? NET));
    return url.toString();
  };

  return {
    NET,
    VAT_RATE,
    GROSS: grossOf(NET),
    euro,
    parseNet,
    grossOf,
    parseYouTubeId,
    cleanName,
    buildLandingUrl,
  };
})();
