(() => {
  if (!document.querySelector("link[href='/cookies.css']")) {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/cookies.css";
    document.head.appendChild(style);
  }

  const NAME = "myreels_cookies";
  const SIX_MONTHS = 60 * 60 * 24 * 183;

  const choice = () => {
    const row = document.cookie.split("; ").find((item) => item.startsWith(`${NAME}=`));
    const value = row ? decodeURIComponent(row.split("=").slice(1).join("=")) : "";
    return value === "all" || value === "necessary" ? value : "";
  };

  const write = (value) => {
    document.cookie = `${NAME}=${encodeURIComponent(value)}; Max-Age=${SIX_MONTHS}; Path=/; SameSite=Lax`;
    document.dispatchEvent(new CustomEvent("myreels-cookies", { detail: value }));
  };

  const english = (() => {
    try {
      const path = location.pathname || "";
      if (/^\/en(\/|$)/.test(path)) return true;
      if (/^\/(?:luxurystayreels|myairbnbreels)(\/|$)/.test(path)) return false;
      return sessionStorage.getItem("myreels_lang") === "en";
    } catch {
      return false;
    }
  })();
  const bar = document.createElement("aside");
  bar.className = "cookie-bar";
  bar.hidden = true;
  bar.setAttribute("role", "dialog");
  bar.setAttribute("aria-label", "Cookies");
  bar.innerHTML = english
    ? `
    <p>We use cookies. <a href="/en/privacy">Privacy policy</a></p>
    <button type="button" class="cookie-bar__yes" data-cookies="all">Accept</button>
  `
    : `
    <p>Χρησιμοποιούμε cookies. <a href="/privacy.html">Πολιτική Απορρήτου</a></p>
    <button type="button" class="cookie-bar__yes" data-cookies="all">Αποδοχή</button>
  `;
  document.body.appendChild(bar);

  const ask = () => {
    bar.hidden = false;
  };

  bar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cookies]");
    if (!button) return;
    write("all");
    bar.hidden = true;
  });

  if (!choice()) ask();

  window.MyReelsCookies = { choice, ask };
})();
