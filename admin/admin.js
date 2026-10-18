(() => {
  const STORAGE_KEY = "myreels_leads";
  const SEQ_KEY = "myreels_sequences";
  const AUTH_KEY = "myreels_admin_auth";
  const ROLE_KEY = "myreels_admin_role";
  const SUB_USER = "myreels_admin_sub_user";
  const SUB_PASS = "myreels_admin_sub_pass";
  const PERM_KEY = "myreels_admin_perms";
  const AUTH_USER = "Thereelproject";
  const AUTH_PASS = "reels4YOU";
  const STAY_USER = "Nakis";
  const STAY_PASS = "Terminator";

  // PWA: register the service worker so the admin can be installed as an app.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  const loginGate = document.getElementById("login-gate");
  const adminApp = document.getElementById("admin-app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const btnLogout = document.getElementById("btn-logout");
  const loginUserInput = document.getElementById("login-user");
  const loginPassInput = document.getElementById("login-pass");
  const loginRememberInput = document.getElementById("login-remember");

  const roleOf = (user, pass) => {
    if (user === AUTH_USER && pass === AUTH_PASS) return "admin";
    if (user === STAY_USER && pass === STAY_PASS) return "stay";
    return "";
  };
  const currentRole = () => {
    const role = sessionStorage.getItem(ROLE_KEY);
    if (role === "admin" || role === "stay" || role === "sub") return role;
    return sessionStorage.getItem(AUTH_KEY) === "1" ? "admin" : "";
  };
  const isStayUser = () => currentRole() === "stay";
  const isAuthed = () => Boolean(currentRole());
  const sessionCreds = () => {
    if (currentRole() === "sub") {
      return { user: sessionStorage.getItem(SUB_USER) || "", pass: sessionStorage.getItem(SUB_PASS) || "" };
    }
    return isStayUser() ? { user: STAY_USER, pass: STAY_PASS } : { user: AUTH_USER, pass: AUTH_PASS };
  };

  const stayPermissions = () => {
    if (currentRole() !== "sub") return null;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(PERM_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const applyRole = () => {
    const role = currentRole();
    document.body.classList.toggle("is-viewer", role === "stay" || role === "sub");
    document.body.classList.toggle("is-sub", role === "sub");
    const meta = document.querySelector(".sidebar__meta");
    if (meta) meta.textContent = role === "sub" ? sessionStorage.getItem(SUB_USER) || "Χρήστης" : role === "stay" ? "Nakis" : "Admin";
    const note = document.getElementById("viewer-note");
    if (note) note.hidden = role !== "stay";
  };

  const rememberSession = (user, pass, found, remember) => {
    sessionStorage.setItem(AUTH_KEY, "1");
    sessionStorage.setItem(ROLE_KEY, found.role);
    if (found.role === "sub") {
      sessionStorage.setItem(SUB_USER, user);
      sessionStorage.setItem(SUB_PASS, pass);
      sessionStorage.setItem(PERM_KEY, JSON.stringify(found.permissions || {}));
    } else {
      sessionStorage.removeItem(SUB_USER);
      sessionStorage.removeItem(SUB_PASS);
      sessionStorage.removeItem(PERM_KEY);
    }
    if (remember) {
      setCookie(COOKIE_USER, user, COOKIE_DAYS);
      setCookie(COOKIE_PASS, pass, COOKIE_DAYS);
    } else {
      deleteCookie(COOKIE_USER);
      deleteCookie(COOKIE_PASS);
    }
  };

  const resolveLogin = async (user, pass) => {
    const role = roleOf(user, pass);
    if (role) return { role, permissions: null };
    const response = await fetch("/api/stay-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", user, pass }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || data.role !== "sub") return null;
    return { role: "sub", permissions: data.permissions || {}, name: data.name || user };
  };

  const COOKIE_USER = "myreels_admin_user";
  const COOKIE_PASS = "myreels_admin_pass";
  const COOKIE_DAYS = 30;

  const getCookie = (name) => {
    const target = `${encodeURIComponent(name)}=`;
    const parts = document.cookie ? document.cookie.split("; ") : [];
    for (const p of parts) {
      if (p.startsWith(target)) return decodeURIComponent(p.slice(target.length));
    }
    return null;
  };

  const setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
      value
    )}; expires=${expires}; path=/admin; samesite=lax${secure}`;
  };

  const deleteCookie = (name) => {
    // Setting an expiry in the past removes the cookie.
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/admin; samesite=lax`;
  };

  const showAdmin = () => {
    document.body.classList.remove("is-login");
    if (loginGate) loginGate.hidden = true;
    if (adminApp) adminApp.hidden = false;
  };

  const showLogin = () => {
    document.body.classList.add("is-login");
    if (loginGate) loginGate.hidden = false;
    if (adminApp) adminApp.hidden = true;
    if (loginError) loginError.hidden = true;
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(SUB_USER);
    sessionStorage.removeItem(SUB_PASS);
    sessionStorage.removeItem(PERM_KEY);
    document.body.classList.remove("is-viewer", "is-sub");
    showLogin();
  };

  // Restore saved login inputs (and optionally auto-login).
  // Note: This is convenience-only. The admin credentials are also hardcoded in this JS.
  (function restoreLoginCookies() {
    const savedUser = getCookie(COOKIE_USER);
    const savedPass = getCookie(COOKIE_PASS);

    if (loginUserInput && savedUser) loginUserInput.value = savedUser;
    if (loginPassInput && savedPass) loginPassInput.value = savedPass;
    if (loginRememberInput && (savedUser || savedPass)) loginRememberInput.checked = true;

    const remembered = roleOf(savedUser, savedPass);
    if (remembered) {
      sessionStorage.setItem(AUTH_KEY, "1");
      sessionStorage.setItem(ROLE_KEY, remembered);
      sessionStorage.removeItem(SUB_USER);
      sessionStorage.removeItem(SUB_PASS);
      sessionStorage.removeItem(PERM_KEY);
    }
  })();

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = String(loginUserInput?.value || "").trim();
      const pass = String(loginPassInput?.value || "");
      const found = await resolveLogin(user, pass);
      if (!found) {
        if (loginError) loginError.hidden = false;
        return;
      }
      rememberSession(user, pass, found, loginRememberInput ? loginRememberInput.checked : true);
      if (window.__myreelsAdminReady) {
        location.reload();
        return;
      }
      applyRole();
      if (loginError) loginError.hidden = true;
      showAdmin();
      initAdmin();
    });
  }

  btnLogout?.addEventListener("click", logout);

  const startApp = () => {
    applyRole();
    showAdmin();
    initAdmin();
  };

  if (isAuthed() && currentRole() !== "sub") {
    startApp();
  } else if (isAuthed() && currentRole() === "sub" && sessionStorage.getItem(SUB_USER)) {
    startApp();
  } else {
    const savedUser = getCookie(COOKIE_USER);
    const savedPass = getCookie(COOKIE_PASS);
    if (savedUser && savedPass && !roleOf(savedUser, savedPass)) {
      resolveLogin(savedUser, savedPass).then((found) => {
        if (!found) {
          showLogin();
          return;
        }
        rememberSession(savedUser, savedPass, found, true);
        startApp();
      });
    } else if (!isAuthed()) {
      showLogin();
    } else {
      startApp();
    }
  }

  function initAdmin() {
    if (window.__myreelsAdminReady) return;
    window.__myreelsAdminReady = true;
    bootAdmin();
  }

  function bootAdmin() {
  const STAGES = [
    { id: "lead", label: "Lead", short: "Lead" },
    { id: "send_offer", label: "Αποστολή Προσφοράς", short: "Προσφορά" },
    { id: "waiting", label: "Αναμονή απάντησης", short: "Αναμονή" },
    {
      id: "accepted",
      label: "Αποδοχή Προσφοράς — Έναρξη Συνεργασίας",
      short: "Αποδοχή",
    },
    { id: "payment", label: "Πληρωμή", short: "Πληρωμή" },
    { id: "rejected", label: "Απόρριψη προσφοράς", short: "Απόρριψη" },
  ];

  const DEFAULT_SEQUENCES = {
    lead: [
      {
        id: "lead-0",
        day: 0,
        subject: "{{name}}, ευχαριστούμε για το ενδιαφέρον — MyReels",
        body: `Γεια σου {{name}},

Ευχαριστούμε που κλείσατε Discovery Call για την {{business}}.

Στόχος μας είναι απλός: σταθερή παρουσία στα Social Media, χωρίς εσένα μπροστά στην κάμερα — με AI Avatar, στρατηγική και επαγγελματικά Reels.

Θα επικοινωνήσουμε σύντομα για να κλείσουμε την κλήση.

Με εκτίμηση,
Η ομάδα MyReels`,
        enabled: true,
      },
      {
        id: "lead-2",
        day: 2,
        subject: "{{name}}, ακόμα διαθέσιμος/η για μια σύντομη κλήση;",
        body: `Γεια σου {{name}},

Ήθελα απλώς να ελέγξω αν εξακολουθεί να σε ενδιαφέρει μια σύντομη συζήτηση για την παρουσία της {{business}} στα Social.

Αν προτιμάς, απάντησε με 2–3 διαθέσιμες ώρες αυτή την εβδομάδα.

MyReels`,
        enabled: true,
      },
    ],
    send_offer: [
      {
        id: "offer-0",
        day: 0,
        subject: "Η πρόταση συνεργασίας για την {{business}}",
        body: `Γεια σου {{name}},

Όπως συζητήσαμε, σου στέλνω την πρόταση συνεργασίας MyReels για την {{business}}.

Υπηρεσίες & τιμές (χωρίς ΦΠΑ):
• Social Media (διαχείριση + content): 300€/μήνα ή Super 600€/3 μήνες
• AI Avatar Videos (30/μήνα): 400€/μήνα ή Super 900€/3 μήνες
• Google My Business (setup + 15 posts): 150€/μήνα ή Super 300€/3 μήνες
• Όλες μαζί: Ρωτήστε μας

{{value_line}}

Αν έχεις ερωτήσεις, είμαι εδώ.

MyReels`,
        enabled: true,
      },
    ],
    waiting: [
      {
        id: "wait-2",
        day: 2,
        subject: "{{name}}, είδες την πρόταση για την {{business}};",
        body: `Γεια σου {{name}},

Απλώς ένα γρήγορο follow-up σχετικά με την πρόταση MyReels.

Υπάρχει κάτι που θέλεις να ξεκαθαρίσουμε πριν αποφασίσεις;

MyReels`,
        enabled: true,
      },
      {
        id: "wait-5",
        day: 5,
        subject: "Τελευταίο check-in για την πρόταση MyReels",
        body: `Γεια σου {{name}},

Καταλαβαίνω ότι ο χρόνος είναι περιορισμένος. Αν η πρόταση δεν είναι προτεραιότητα αυτή τη στιγμή, πες μου — δεν υπάρχει πρόβλημα.

Αν όμως θέλεις να προχωρήσουμε με την {{business}}, είμαι έτοιμος/η να ξεκινήσουμε αμέσως.

MyReels`,
        enabled: true,
      },
    ],
    accepted: [
      {
        id: "accept-0",
        day: 0,
        subject: "Καλώς ήρθες — ξεκινάμε την συνεργασία MyReels",
        body: `Γεια σου {{name}},

Χαιρόμαστε που προχωράμε με την {{business}}!

Επόμενο βήμα: συμπλήρωσε τη φόρμα onboarding (≈10–15΄).
Με αυτές τις πληροφορίες γράφουμε scripts και ετοιμάζουμε λήψεις / AI Avatar / GMB.

{{onboarding_url}}

Μόλις τη στείλεις, ξεκινάμε.

MyReels`,
        enabled: true,
      },
      {
        id: "accept-1",
        day: 1,
        subject: "Υπενθύμιση onboarding — {{business}}",
        body: `Γεια σου {{name}},

Ένα γρήγορο check-in για τη φόρμα onboarding της {{business}}.

Χρειαζόμαστε στοιχεία brand, social, θεματολόγιο και links υλικού για να ξεκινήσουμε παραγωγή.

Συμπλήρωσε εδώ:
{{onboarding_url}}

Αν κολλήσεις κάπου, απάντησε σε αυτό το email.

MyReels`,
        enabled: true,
      },
    ],
    payment: [
      {
        id: "pay-0",
        day: 0,
        subject: "Οδηγίες πληρωμής — MyReels / {{business}}",
        body: `Γεια σου {{name}},

Για να ενεργοποιηθεί επίσημα η συνεργασία της {{business}}, ακολουθούν οι οδηγίες πληρωμής.

{{value_line}}

Μόλις ολοκληρωθεί η πληρωμή, ξεκινάμε αμέσως την παραγωγή.

MyReels`,
        enabled: true,
      },
      {
        id: "pay-3",
        day: 3,
        subject: "Υπενθύμιση πληρωμής — {{business}}",
        body: `Γεια σου {{name}},

Μια φιλική υπενθύμιση για την εκκρεμή πληρωμή ώστε να ξεκινήσουμε την παραγωγή για την {{business}}.

Αν χρειάζεσαι τιμολόγιο ή εναλλακτικό τρόπο πληρωμής, πες μου.

MyReels`,
        enabled: true,
      },
    ],
    rejected: [
      {
        id: "rej-0",
        day: 0,
        subject: "Ευχαριστούμε για τον χρόνο σου, {{name}}",
        body: `Γεια σου {{name}},

Ευχαριστούμε που εξέτασες την πρόταση MyReels για την {{business}}.

Αν στο μέλλον θελήσεις σταθερή παρουσία στα Social χωρίς να είσαι στην κάμερα, είμαστε εδώ.

Καλή συνέχεια,
MyReels`,
        enabled: true,
      },
      {
        id: "rej-30",
        day: 30,
        subject: "{{name}}, άλλαξαν κάτι στην {{business}};",
        body: `Γεια σου {{name}},

Πέρασε λίγος καιρός από την τελευταία μας συζήτηση. Αν η ανάγκη για σταθερό περιεχόμενο στα Social είναι ακόμα ανοιχτή, θα χαρώ να ξανασυζητήσουμε.

MyReels`,
        enabled: true,
      },
    ],
  };

  const SERVICES = window.MYREELS_SERVICES || [];

  const DEMO_LEADS = [
    {
      id: "demo-1",
      name: "Μαρία Παπαδοπούλου",
      business: "Glow Aesthetics",
      email: "maria@glow.gr",
      phone: "6944123456",
      stage: "lead",
      services: ["content", "videos"],
      value: 300,
      notes: "Discovery call Τρίτη 11:00",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: "demo-2",
      name: "Γιώργος Νικολάου",
      business: "Nikolaou Dental",
      email: "info@nikolaoudental.gr",
      phone: "2101234567",
      stage: "send_offer",
      services: ["content"],
      value: 300,
      notes: "Θέλει 12 Reels / μήνα",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000,
    },
    {
      id: "demo-3",
      name: "Ελένη Κ.",
      business: "Café Aurora",
      email: "hello@aurora.gr",
      phone: "",
      stage: "waiting",
      services: ["maps", "content"],
      value: 450,
      notes: "Προσφορά στάλθηκε 18/07",
      createdAt: Date.now() - 86400000 * 8,
      updatedAt: Date.now() - 86400000 * 3,
    },
    {
      id: "demo-4",
      name: "Αντώνης Βλάχος",
      business: "Vlachos Law",
      email: "a.vlachos@law.gr",
      phone: "6977001122",
      stage: "accepted",
      services: ["videos", "content"],
      value: 700,
      notes: "Onboarding επόμενη εβδομάδα",
      createdAt: Date.now() - 86400000 * 12,
      updatedAt: Date.now() - 3600000,
    },
  ];

  // DOM
  const board = document.getElementById("board");
  const statsEl = document.getElementById("stats");
  const searchInput = document.getElementById("search");
  const btnNew = document.getElementById("btn-new");
  const modal = document.getElementById("modal");
  const form = document.getElementById("lead-form");
  const modalTitle = document.getElementById("modal-title");
  const btnDelete = document.getElementById("btn-delete");
  const btnSave = document.getElementById("btn-save");
  const stageSelect = document.getElementById("lead-stage");
  const seqStagesEl = document.getElementById("seq-stages");
  const seqEmailsEl = document.getElementById("seq-emails");
  const seqToolbarEl = document.getElementById("seq-toolbar");
  const seqLeadsEl = document.getElementById("seq-leads");
  const btnAddEmail = document.getElementById("btn-add-email");
  const btnResetSeq = document.getElementById("btn-reset-seq");
  const emailModal = document.getElementById("email-modal");
  const btnCopyEmail = document.getElementById("btn-copy-email");
  const btnMailto = document.getElementById("btn-mailto");
  const svcCatalogEl = document.getElementById("svc-catalog");
  const serviceStatsEl = document.getElementById("service-stats");
  const leadServicesEl = document.getElementById("lead-services");

  let leads = [];
  let sequences = {};
  let query = "";
  let dragId = null;
  let activeTab = "pipeline";
  let activeSeqStage = "lead";
  let previewPayload = null;

  function serviceById(id) {
    return SERVICES.find((s) => s.id === id);
  }

  function serviceName(id) {
    return serviceById(id)?.name || id;
  }

  function normalizeLead(lead) {
    if (!Array.isArray(lead.services)) lead.services = [];
    // migrate old "avatar" id → "videos"
    lead.services = lead.services.map((id) => (id === "avatar" ? "videos" : id));
    return lead;
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SEQUENCES));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        leads = JSON.parse(raw).map(normalizeLead);
      } else {
        leads = DEMO_LEADS.map((l) => normalizeLead({ ...l }));
        save();
      }
    } catch {
      leads = DEMO_LEADS.map((l) => normalizeLead({ ...l }));
    }

    try {
      const rawSeq = localStorage.getItem(SEQ_KEY);
      if (rawSeq) {
        sequences = JSON.parse(rawSeq);
        // Ensure all stages exist
        STAGES.forEach((s) => {
          if (!Array.isArray(sequences[s.id])) {
            sequences[s.id] = cloneDefaults()[s.id] || [];
          }
        });
        // Refresh offer + accepted onboarding templates when outdated
        const defaults = cloneDefaults();
        const offer0 = (sequences.send_offer || []).find((m) => m.id === "offer-0");
        const defaultOffer0 = (defaults.send_offer || []).find((m) => m.id === "offer-0");
        if (
          offer0 &&
          defaultOffer0 &&
          !String(offer0.body || "").includes("Super 300€/3 μήνες")
        ) {
          offer0.body = defaultOffer0.body;
          offer0.subject = defaultOffer0.subject;
          saveSequences();
        }
        const accept0 = (sequences.accepted || []).find((m) => m.id === "accept-0");
        const defaultAccept0 = (defaults.accepted || []).find((m) => m.id === "accept-0");
        if (
          accept0 &&
          defaultAccept0 &&
          !String(accept0.body || "").includes("{{onboarding_url}}")
        ) {
          sequences.accepted = defaults.accepted;
          saveSequences();
        }
      } else {
        sequences = cloneDefaults();
        saveSequences();
      }
    } catch {
      sequences = cloneDefaults();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }

  function saveSequences() {
    localStorage.setItem(SEQ_KEY, JSON.stringify(sequences));
  }

  function uid(prefix = "lead") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatDate(ts) {
    return new Intl.DateTimeFormat("el-GR", {
      day: "numeric",
      month: "short",
    }).format(new Date(ts));
  }

  function formatMoney(n) {
    if (n == null || n === "" || Number.isNaN(Number(n))) return null;
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number(n));
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildOnboardingUrl(lead) {
    const url = new URL("/onboarding.html", window.location.origin);
    if (!lead) return url.toString();
    if (lead.id) url.searchParams.set("lead", lead.id);
    if (lead.name) url.searchParams.set("name", lead.name);
    if (lead.business) url.searchParams.set("business", lead.business);
    if (lead.email) url.searchParams.set("email", lead.email);
    if (lead.phone) url.searchParams.set("phone", lead.phone);
    if (Array.isArray(lead.services) && lead.services.length) {
      url.searchParams.set("services", lead.services.join(","));
    }
    return url.toString();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function personalize(text, lead) {
    const money = formatMoney(lead.value);
    const valueLine = money
      ? `Επένδυση: ${money} (χωρίς ΦΠΑ)`
      : "Τα οικονομικά στοιχεία βρίσκονται στην πρόταση.";
    const onboardingUrl = buildOnboardingUrl(lead);
    return String(text || "")
      .replaceAll("{{name}}", lead.name || "")
      .replaceAll("{{business}}", lead.business || "")
      .replaceAll("{{value}}", money || "")
      .replaceAll("{{value_line}}", valueLine)
      .replaceAll("{{email}}", lead.email || "")
      .replaceAll("{{phone}}", lead.phone || "")
      .replaceAll("{{onboarding_url}}", onboardingUrl);
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.business, l.email, l.phone, l.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }

  function stageLabel(id) {
    return STAGES.find((s) => s.id === id)?.label || id;
  }

  /* ─── Tabs ─── */
  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".view").forEach((view) => {
      const on = view.dataset.view === tab;
      view.classList.toggle("is-active", on);
      view.hidden = !on;
    });
    if (tab === "sequences") renderSequences();
    if (tab === "pipeline") renderBoard();
    if (tab === "services") renderServicesCatalog();
    if (tab === "onboarding") renderOnboardingTab();
    if (tab === "stays") {
      renderStayList();
      loadStayBoard();
      loadGoogleLink();
    }
    if (tab === "payments") loadPayments();
    if (tab === "mail") loadMail();
  }

  async function loadPayments() {
    const list = document.getElementById("pay-list");
    if (!list) return;
    list.innerHTML = `<p class="stay-hint">Φόρτωση πληρωμών…</p>`;
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionCreds()),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Οι πληρωμές δεν φορτώθηκαν.");
      }
      const orders = Array.isArray(payload.orders) ? payload.orders : [];
      if (!orders.length) {
        list.innerHTML = `<p class="stay-hint">Δεν υπάρχει ολοκληρωμένη πληρωμή ακόμα.</p>`;
        return;
      }
      list.innerHTML = orders
        .map((order) => {
          const when = order.created
            ? new Date(order.created).toLocaleString("el-GR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          const who = [order.buyerName, order.property].filter(Boolean).join(" · ") || "Πληρωμή";
          const detail = [when, order.email, order.phone, order.label, order.amountLabel].filter(Boolean).join(" · ");
          return `
            <article class="stay-row">
              <div>
                <strong>${escapeHtml(who)}</strong>
                <small>${escapeHtml(detail)}</small>
              </div>
            </article>
          `;
        })
        .join("");
    } catch (err) {
      list.innerHTML = `<p class="stay-hint stay-hint--error">${escapeHtml(err?.message || "Κάτι πήγε στραβά.")}</p>`;
    }
  }

  document.getElementById("pay-refresh")?.addEventListener("click", () => loadPayments());

  const mailState = { folder: "INBOX", folders: [], messages: [], selected: null, configured: false };

  async function mailRequest(payload) {
    const response = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sessionCreds(), ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Το ταχυδρομείο δεν φορτώθηκε.");
    }
    return data;
  }

  function mailDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("el-GR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function mailSender(message) {
    if (message.direction === "outbound") return `Προς: ${message.toAddresses || ""}`;
    return message.fromName
      ? `${message.fromName} <${message.fromAddress}>`
      : message.fromAddress || "Άγνωστος";
  }

  function renderMailFolders() {
    const box = document.getElementById("mail-folders");
    if (!box) return;
    const unread = mailState.folders.find((folder) => folder.label === "Εισερχόμενα")?.unseen || 0;
    const unreadEl = document.getElementById("mail-unread");
    if (unreadEl) unreadEl.textContent = String(unread);
    box.innerHTML = mailState.folders
      .map((folder) => {
        const active = folder.path === mailState.folder ? " is-active" : "";
        const badge = folder.unseen > 0 ? `<span class="mail__badge">${folder.unseen}</span>` : "";
        const count = folder.total > 0 ? ` (${folder.total})` : "";
        return `<button type="button" class="mail__folder${active}" data-folder="${escapeHtml(folder.path)}"><span>${escapeHtml(folder.label)}${count}</span>${badge}</button>`;
      })
      .join("");
    box.querySelectorAll("[data-folder]").forEach((button) => {
      button.addEventListener("click", () => {
        mailState.folder = button.dataset.folder;
        mailState.selected = null;
        renderMailReader();
        loadMailMessages();
      });
    });
  }

  function renderMailList() {
    const list = document.getElementById("mail-list");
    const title = document.getElementById("mail-folder-title");
    const current = mailState.folders.find((folder) => folder.path === mailState.folder);
    if (title) title.textContent = current?.label || "Εισερχόμενα";
    if (!list) return;
    if (!mailState.messages.length) {
      list.innerHTML = `<p class="mail__empty">Δεν υπάρχουν μηνύματα σε αυτόν τον φάκελο.</p>`;
      return;
    }
    list.innerHTML = mailState.messages
      .map((message) => {
        const active = mailState.selected?.id === message.id ? " is-active" : "";
        const unread = message.isRead ? "" : " is-unread";
        return `
          <button type="button" class="mail__item${active}${unread}" data-uid="${escapeHtml(message.id)}">
            <div>
              <p class="mail__from">${escapeHtml(mailSender(message))}</p>
              <p class="mail__subject">${escapeHtml(message.subject)}</p>
              <p class="mail__snippet">${escapeHtml(message.snippet || "")}</p>
            </div>
            <span class="mail__when">${escapeHtml(mailDate(message.receivedAt))}</span>
          </button>`;
      })
      .join("");
    list.querySelectorAll("[data-uid]").forEach((button) => {
      button.addEventListener("click", () => openMail(button.dataset.uid));
    });
  }

  function mailAddress(value) {
    const match = String(value || "").match(/[^\s<>]+@[^\s<>]+/);
    return match ? match[0] : "";
  }

  function conversationOf(message) {
    return Array.isArray(message.thread) && message.thread.length ? message.thread : [message];
  }

  function renderMailReader() {
    const reader = document.getElementById("mail-reader");
    const message = mailState.selected;
    if (!reader) return;
    if (!message) {
      reader.innerHTML = `<p class="mail__empty">Επίλεξε ένα μήνυμα για προβολή ή απάντηση.</p>`;
      return;
    }
    const items = conversationOf(message);
    const latestInbound = [...items].reverse().find((item) => item.direction === "inbound");
    const replyTo = latestInbound
      ? latestInbound.fromAddress
      : mailAddress(message.toAddresses);
    const baseSubject = items[0]?.subject || message.subject || "";
    const replySubject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;
    const bubbles = items
      .map((item) => {
        const mine = item.direction === "outbound";
        const who = mine ? "Εσύ" : item.fromName || item.fromAddress || "Εκείνοι";
        return `
          <article class="mail__bubble ${mine ? "mail__bubble--out" : "mail__bubble--in"}">
            <p class="mail__meta">${escapeHtml(who)} · ${escapeHtml(mailDate(item.receivedAt))}</p>
            <div class="mail__text">${escapeHtml(item.bodyText || item.snippet || "Χωρίς κείμενο")}</div>
          </article>`;
      })
      .join("");
    reader.innerHTML = `
      <div class="mail__head">
        <h3>${escapeHtml(message.subject)}</h3>
      </div>
      <div class="mail__thread" id="mail-thread">${bubbles}</div>
      ${
        replyTo && !isStayUser()
          ? `<form class="mail__reply" id="mail-reply">
              <h4>Απάντηση</h4>
              <input type="email" name="to" value="${escapeHtml(replyTo)}" required />
              <input type="text" name="subject" value="${escapeHtml(replySubject)}" required />
              <input type="hidden" name="replyTo" value="${escapeHtml(latestInbound?.messageId || message.messageId || "")}" />
              <textarea name="text" placeholder="Γράψε την απάντησή σου…" required></textarea>
              <button type="submit" class="mail__send">Αποστολή</button>
            </form>`
          : ""
      }`;
    const thread = document.getElementById("mail-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
    document.getElementById("mail-reply")?.addEventListener("submit", sendMailReply);
  }

  function setMailBusy(busy) {
    document.querySelectorAll("#mail-sync, #mail-sync-all").forEach((button) => {
      button.disabled = busy;
    });
  }

  function showMailProblem(message) {
    const status = document.getElementById("mail-status");
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || "";
  }

  async function loadMail() {
    const setup = document.getElementById("mail-setup");
    const grid = document.getElementById("mail-grid");
    showMailProblem("");
    setMailBusy(true);
    try {
      const status = await mailRequest({ action: "status" });
      mailState.configured = Boolean(status.configured);
      if (!status.configured) {
        if (setup) {
          setup.hidden = false;
          setup.textContent =
            "Το contact@myreels.gr δεν έχει κωδικό mailbox στο Vercel. Βάλε MAILBOX_PASSWORD και ξαναφόρτωσε.";
        }
        if (grid) grid.hidden = true;
        return;
      }
      if (setup) setup.hidden = true;
      if (grid) grid.hidden = false;
      const folders = await mailRequest({ action: "folders" });
      mailState.folders = folders.folders || [];
      if (!mailState.folders.some((folder) => folder.path === mailState.folder)) {
        mailState.folder = mailState.folders[0]?.path || "INBOX";
      }
      renderMailFolders();
      await loadMailMessages();
    } catch (err) {
      if (grid) grid.hidden = true;
      showMailProblem(err?.message || "Το ταχυδρομείο δεν φορτώθηκε.");
    } finally {
      setMailBusy(false);
    }
  }

  async function loadMailMessages() {
    const list = document.getElementById("mail-list");
    if (list) list.innerHTML = `<p class="mail__empty">Φόρτωση…</p>`;
    renderMailFolders();
    try {
      const payload = await mailRequest({ action: "messages", folder: mailState.folder });
      mailState.messages = payload.messages || [];
      renderMailList();
    } catch (err) {
      showMailProblem(err?.message || "Τα μηνύματα δεν φορτώθηκαν.");
    }
  }

  async function openMail(uid) {
    showMailProblem("");
    const reader = document.getElementById("mail-reader");
    if (reader) reader.innerHTML = `<p class="mail__empty">Φόρτωση συνομιλίας…</p>`;
    try {
      const payload = await mailRequest({ action: "read", folder: mailState.folder, uid });
      mailState.selected = payload.message;
      mailState.messages = mailState.messages.map((message) =>
        message.id === String(uid) ? { ...message, isRead: true } : message
      );
      renderMailList();
      renderMailReader();
    } catch (err) {
      showMailProblem(err?.message || "Το μήνυμα δεν άνοιξε.");
    }
  }

  async function sendMailReply(event) {
    event.preventDefault();
    if (isStayUser()) return;
    const form = event.currentTarget;
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    showMailProblem("");
    try {
      await mailRequest({
        action: "send",
        to: form.to.value,
        subject: form.subject.value,
        text: form.text.value,
        inReplyTo: form.replyTo?.value || mailState.selected?.messageId || "",
      });
      const uid = mailState.selected?.id;
      if (uid) await openMail(uid);
    } catch (err) {
      showMailProblem(err?.message || "Η απάντηση δεν στάλθηκε.");
      if (button) button.disabled = false;
    }
  }

  document.getElementById("mail-sync")?.addEventListener("click", () => loadMailMessages());
  document.getElementById("mail-sync-all")?.addEventListener("click", () => {
    mailState.selected = null;
    loadMail();
  });

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  /* ─── Pipeline ─── */
  function renderStats() {
    const total = leads.length;
    const active = leads.filter((l) => l.stage !== "rejected").length;
    const pipelineValue = leads
      .filter((l) => !["rejected", "payment"].includes(l.stage))
      .reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const won = leads
      .filter((l) => l.stage === "payment")
      .reduce((sum, l) => sum + (Number(l.value) || 0), 0);

    statsEl.innerHTML = `
      <div class="stat">
        <div class="stat__label">Σύνολο</div>
        <div class="stat__value">${total}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Ενεργά</div>
        <div class="stat__value">${active}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Pipeline</div>
        <div class="stat__value">${formatMoney(pipelineValue) || "—"}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Πληρωμές</div>
        <div class="stat__value">${formatMoney(won) || "—"}</div>
      </div>
    `;
  }

  function cardHTML(lead) {
    const money = formatMoney(lead.value);
    const contact = lead.email || lead.phone || "";
    const svcs = (lead.services || [])
      .map((id) => {
        const s = serviceById(id);
        return s
          ? `<span class="chip chip--${s.id}">${escapeHtml(s.name)}</span>`
          : "";
      })
      .join("");
    return `
      <article class="card" draggable="${isStayUser() ? "false" : "true"}" data-id="${lead.id}" tabindex="0">
        <div class="card__name">${escapeHtml(lead.name)}</div>
        <div class="card__business">${escapeHtml(lead.business)}</div>
        ${svcs ? `<div class="card__chips">${svcs}</div>` : ""}
        <div class="card__meta">
          ${money ? `<span class="card__value">${money}</span>` : ""}
          <span class="card__date">${formatDate(lead.updatedAt || lead.createdAt)}</span>
        </div>
        ${contact ? `<div class="card__contact">${escapeHtml(contact)}</div>` : ""}
        ${
          !isStayUser() && (lead.stage === "accepted" || lead.stage === "payment")
            ? `<button type="button" class="card__onboard" data-onboard="${lead.id}">Onboarding link</button>`
            : ""
        }
      </article>
    `;
  }

  function renderBoard() {
    const list = filtered();
    board.innerHTML = STAGES.map((stage) => {
      const cards = list.filter((l) => l.stage === stage.id);
      const rejectedClass = stage.id === "rejected" ? " column--rejected" : "";
      return `
        <section class="column${rejectedClass}" data-stage="${stage.id}">
          <header class="column__header">
            <span class="column__dot" aria-hidden="true"></span>
            <h2 class="column__title">${stage.label}</h2>
            <span class="column__count">${cards.length}</span>
          </header>
          <div class="column__cards" data-stage="${stage.id}">
            ${
              cards.length
                ? cards.map(cardHTML).join("")
                : `<div class="card__empty">Κενό</div>`
            }
          </div>
        </section>
      `;
    }).join("");

    bindDrag();
    bindCards();
    renderStats();
  }

  function bindCards() {
    board.querySelectorAll(".card").forEach((el) => {
      el.addEventListener("click", (e) => {
        const onboardBtn = e.target.closest("[data-onboard]");
        if (onboardBtn) {
          e.stopPropagation();
          const lead = leads.find((l) => l.id === onboardBtn.dataset.onboard);
          if (!lead) return;
          copyText(buildOnboardingUrl(lead)).then((ok) => {
            onboardBtn.textContent = ok ? "Αντιγράφηκε ✓" : "Αποτυχία";
            setTimeout(() => {
              onboardBtn.textContent = "Onboarding link";
            }, 1600);
          });
          return;
        }
        openEdit(el.dataset.id);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEdit(el.dataset.id);
        }
      });
    });
  }

  function bindDrag() {
    if (isStayUser()) return;
    board.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        dragId = card.dataset.id;
        card.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragId);
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        dragId = null;
        board.querySelectorAll(".column").forEach((c) => c.classList.remove("is-drag-over"));
      });
    });

    board.querySelectorAll(".column").forEach((col) => {
      const dropZone = col.querySelector(".column__cards");

      const onDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        col.classList.add("is-drag-over");
      };

      const onDragLeave = (e) => {
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove("is-drag-over");
        }
      };

      const onDrop = (e) => {
        e.preventDefault();
        col.classList.remove("is-drag-over");
        const id = e.dataTransfer.getData("text/plain") || dragId;
        const stage = col.dataset.stage;
        if (!id || !stage) return;
        moveLead(id, stage);
      };

      col.addEventListener("dragover", onDragOver);
      dropZone.addEventListener("dragover", onDragOver);
      col.addEventListener("dragleave", onDragLeave);
      col.addEventListener("drop", onDrop);
      dropZone.addEventListener("drop", onDrop);
    });
  }

  function moveLead(id, stage) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    lead.stage = stage;
    lead.updatedAt = Date.now();
    save();
    renderBoard();
    if (activeTab === "sequences") renderSequences();
  }

  function fillStageSelect(selected) {
    stageSelect.innerHTML = STAGES.map(
      (s) =>
        `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${s.label}</option>`
    ).join("");
  }

  function fillServiceChecks(selected = []) {
    const set = new Set(selected);
    leadServicesEl.innerHTML = SERVICES.map((s) => {
      const monthly = s.priceMonthly != null ? `${s.priceMonthly}€/μήνα` : "";
      const quarterly =
        s.priceQuarterly != null ? `Super ${s.priceQuarterly}€/3 μήνες` : "";
      const priceLine = [monthly, quarterly].filter(Boolean).join(" · ");
      return `
      <label class="svc-check">
        <input type="checkbox" name="services" value="${s.id}" ${set.has(s.id) ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(s.name)}</strong>
          <small>${escapeHtml(s.short)}</small>
          ${
            priceLine
              ? `<small class="svc-check__price">${escapeHtml(priceLine)} · χωρίς ΦΠΑ</small>`
              : ""
          }
        </span>
      </label>
    `;
    }).join("");
  }

  function selectedServicesFromForm() {
    return [...leadServicesEl.querySelectorAll('input[name="services"]:checked')].map(
      (el) => el.value
    );
  }

  function lockLeadForm(locked) {
    form.querySelectorAll("input, textarea, select").forEach((el) => {
      if (el.type === "hidden") return;
      el.disabled = locked;
    });
    if (btnSave) btnSave.hidden = locked;
    if (locked && btnDelete) btnDelete.hidden = true;
  }

  function openNew() {
    if (isStayUser()) return;
    modalTitle.textContent = "Νέο Lead";
    form.reset();
    document.getElementById("lead-id").value = "";
    fillStageSelect("lead");
    fillServiceChecks([]);
    btnDelete.hidden = true;
    lockLeadForm(false);
    modal.showModal();
    document.getElementById("lead-name").focus();
  }

  function openEdit(id) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    modalTitle.textContent = isStayUser() ? "Προβολή lead" : "Επεξεργασία Lead";
    document.getElementById("lead-id").value = lead.id;
    document.getElementById("lead-name").value = lead.name || "";
    document.getElementById("lead-business").value = lead.business || "";
    document.getElementById("lead-email").value = lead.email || "";
    document.getElementById("lead-phone").value = lead.phone || "";
    document.getElementById("lead-value").value = lead.value ?? "";
    document.getElementById("lead-notes").value = lead.notes || "";
    fillStageSelect(lead.stage);
    fillServiceChecks(lead.services || []);
    btnDelete.hidden = isStayUser();
    lockLeadForm(isStayUser());
    modal.showModal();
  }

  function upsertFromForm() {
    if (isStayUser()) return;
    const id = document.getElementById("lead-id").value;
    const payload = {
      name: document.getElementById("lead-name").value.trim(),
      business: document.getElementById("lead-business").value.trim(),
      email: document.getElementById("lead-email").value.trim(),
      phone: document.getElementById("lead-phone").value.trim(),
      stage: document.getElementById("lead-stage").value,
      services: selectedServicesFromForm(),
      value: document.getElementById("lead-value").value
        ? Number(document.getElementById("lead-value").value)
        : null,
      notes: document.getElementById("lead-notes").value.trim(),
      updatedAt: Date.now(),
    };

    if (!payload.name || !payload.business) return;

    if (id) {
      const idx = leads.findIndex((l) => l.id === id);
      if (idx >= 0) {
        leads[idx] = { ...leads[idx], ...payload };
      }
    } else {
      leads.unshift({
        id: uid(),
        createdAt: Date.now(),
        ...payload,
      });
    }
    save();
    renderBoard();
    if (activeTab === "sequences") renderSequences();
    if (activeTab === "services") renderServicesCatalog();
  }

  function deleteLead() {
    if (isStayUser()) return;
    const id = document.getElementById("lead-id").value;
    if (!id) return;
    if (!confirm("Διαγραφή αυτού του lead;")) return;
    leads = leads.filter((l) => l.id !== id);
    save();
    modal.close();
    renderBoard();
    if (activeTab === "sequences") renderSequences();
  }

  /* ─── Services catalog ─── */
  function renderServicesCatalog() {
    if (serviceStatsEl) {
      serviceStatsEl.innerHTML = SERVICES.map((s) => {
        const count = leads.filter((l) => (l.services || []).includes(s.id)).length;
        return `
          <div class="stat">
            <div class="stat__label">${escapeHtml(s.name)}</div>
            <div class="stat__value">${count}</div>
          </div>
        `;
      }).join("");
    }

    svcCatalogEl.innerHTML = SERVICES.map((s) => {
      const related = leads.filter((l) => (l.services || []).includes(s.id));
      const priceBlock = s.priceMonthly
        ? `<div class="svc-panel__prices">
            <span><strong>${s.priceMonthly}€</strong>/μήνα</span>
            ${
              s.priceQuarterly
                ? `<span class="svc-panel__deal">Super: <strong>${s.priceQuarterly}€</strong>/3 μήνες</span>`
                : ""
            }
            <small>χωρίς ΦΠΑ</small>
          </div>`
        : "";
      return `
        <article class="svc-panel" data-service="${s.id}">
          <header class="svc-panel__header">
            <span class="svc-panel__code">${s.code}</span>
            <div>
              <p class="svc-panel__cat">${escapeHtml(s.category)}</p>
              <h2 class="svc-panel__title">${escapeHtml(s.name)}</h2>
            </div>
            <span class="svc-panel__count">${related.length} leads</span>
          </header>
          <p class="svc-panel__pitch">${escapeHtml(s.pitch)}</p>
          ${priceBlock}
          <ul class="svc-panel__list">
            ${s.includes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
          <p class="svc-panel__result">${escapeHtml(s.result)}</p>
          <div class="svc-panel__leads">
            <h3>Συνδεδεμένα leads</h3>
            ${
              related.length
                ? `<ul>${related
                    .map(
                      (l) =>
                        `<li><button type="button" class="linkish" data-open-lead="${l.id}">${escapeHtml(
                          l.name
                        )}</button> · ${escapeHtml(l.business)} · <em>${escapeHtml(
                          stageLabel(l.stage)
                        )}</em></li>`
                    )
                    .join("")}</ul>`
                : `<p class="seq-empty" style="padding:12px">Κανένα lead ακόμη.</p>`
            }
          </div>
        </article>
      `;
    }).join("");

    svcCatalogEl.querySelectorAll("[data-open-lead]").forEach((btn) => {
      btn.addEventListener("click", () => openEdit(btn.dataset.openLead));
    });
  }

  /* ─── Sequences ─── */
  function sortedEmails(stageId) {
    return [...(sequences[stageId] || [])].sort((a, b) => a.day - b.day);
  }

  function renderSequences() {
    const viewOnly = isStayUser();
    const stageLeads = leads.filter((l) => l.stage === activeSeqStage);
    const emails = sortedEmails(activeSeqStage);

    seqStagesEl.innerHTML = STAGES.map((s) => {
      const count = (sequences[s.id] || []).length;
      const leadCount = leads.filter((l) => l.stage === s.id).length;
      return `
        <button type="button" class="seq-stage${s.id === activeSeqStage ? " is-active" : ""}" data-stage="${s.id}">
          <span class="seq-stage__dot" data-stage="${s.id}"></span>
          <span class="seq-stage__text">
            <strong>${escapeHtml(s.short)}</strong>
            <small>${count} email · ${leadCount} leads</small>
          </span>
        </button>
      `;
    }).join("");

    seqStagesEl.querySelectorAll(".seq-stage").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeSeqStage = btn.dataset.stage;
        renderSequences();
      });
    });

    seqToolbarEl.innerHTML = `
      <div>
        <h2 class="seq-toolbar__title">${escapeHtml(stageLabel(activeSeqStage))}</h2>
        <p class="seq-toolbar__sub">${emails.length} emails στη sequence · ${stageLeads.length} leads σε αυτό το στάδιο</p>
      </div>
    `;

    if (!emails.length) {
      seqEmailsEl.innerHTML = `<div class="seq-empty">Δεν υπάρχουν emails. Πάτα «+ Email» για να προσθέσεις.</div>`;
    } else {
      seqEmailsEl.innerHTML = emails
        .map(
          (email, index) => `
        <article class="seq-card${email.enabled === false ? " is-disabled" : ""}" data-email-id="${email.id}">
          <header class="seq-card__header">
            <label class="seq-day">
              <span>Ημέρα</span>
              <input type="number" min="0" max="365" value="${email.day}" data-field="day" ${viewOnly ? "disabled" : ""} />
            </label>
            <span class="seq-card__order">#${index + 1}</span>
            <label class="seq-toggle">
              <input type="checkbox" data-field="enabled" ${email.enabled !== false ? "checked" : ""} ${viewOnly ? "disabled" : ""} />
              Ενεργό
            </label>
            ${viewOnly ? "" : `<button type="button" class="btn btn--sm btn--danger btn--ghost" data-action="delete">Διαγραφή</button>`}
          </header>
          <label class="field">
            <span>Θέμα</span>
            <input type="text" value="${escapeHtml(email.subject)}" data-field="subject" ${viewOnly ? "disabled" : ""} />
          </label>
          <label class="field">
            <span>Σώμα</span>
            <textarea rows="8" data-field="body" ${viewOnly ? "disabled" : ""}>${escapeHtml(email.body)}</textarea>
          </label>
        </article>
      `
        )
        .join("");
    }

    seqEmailsEl.querySelectorAll(".seq-card").forEach((card) => {
      const emailId = card.dataset.emailId;

      card.querySelectorAll("[data-field]").forEach((input) => {
        const eventName = input.type === "checkbox" ? "change" : "change";
        input.addEventListener(eventName, () => {
          updateEmailField(emailId, input.dataset.field, input);
        });
        if (input.tagName === "TEXTAREA" || (input.tagName === "INPUT" && input.type === "text")) {
          input.addEventListener("blur", () => {
            updateEmailField(emailId, input.dataset.field, input);
          });
        }
      });

      card.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        if (!confirm("Διαγραφή αυτού του email από τη sequence;")) return;
        sequences[activeSeqStage] = (sequences[activeSeqStage] || []).filter(
          (e) => e.id !== emailId
        );
        saveSequences();
        renderSequences();
      });
    });

    // Leads sidebar
    if (!stageLeads.length) {
      seqLeadsEl.innerHTML = `
        <h3 class="seq-leads__title">Leads στο στάδιο</h3>
        <p class="seq-empty">Κανένα lead σε αυτό το στάδιο.</p>
      `;
    } else {
      const firstEmail = emails.find((e) => e.enabled !== false) || emails[0];
      seqLeadsEl.innerHTML = `
        <h3 class="seq-leads__title">Leads στο στάδιο</h3>
        <div class="seq-leads__list">
          ${stageLeads
            .map(
              (lead) => `
            <div class="seq-lead">
              <div>
                <strong>${escapeHtml(lead.name)}</strong>
                <small>${escapeHtml(lead.business)}</small>
                <small class="seq-lead__email">${escapeHtml(lead.email || "Χωρίς email")}</small>
              </div>
              ${
                viewOnly
                  ? ""
                  : `<button type="button" class="btn btn--sm" data-send="${lead.id}" ${
                      !lead.email || !firstEmail ? "disabled" : ""
                    }>Στείλε</button>`
              }
            </div>
          `
            )
            .join("")}
        </div>
        ${
          !viewOnly && emails.length > 1
            ? `<p class="seq-leads__hint">Το κουμπί «Στείλε» ανοίγει το 1ο ενεργό email της sequence, προσωποποιημένο.</p>`
            : ""
        }
      `;

      seqLeadsEl.querySelectorAll("[data-send]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const lead = leads.find((l) => l.id === btn.dataset.send);
          const email = sortedEmails(activeSeqStage).find((e) => e.enabled !== false);
          if (!lead || !email) return;
          openEmailPreview(lead, email);
        });
      });
    }
  }

  function updateEmailField(emailId, field, input) {
    if (isStayUser()) return;
    const list = sequences[activeSeqStage] || [];
    const email = list.find((e) => e.id === emailId);
    if (!email) return;

    if (field === "enabled") {
      email.enabled = input.checked;
    } else if (field === "day") {
      email.day = Math.max(0, Number(input.value) || 0);
    } else {
      email[field] = input.value;
    }
    saveSequences();

    if (field === "day" || field === "enabled") {
      renderSequences();
    }
  }

  function addEmail() {
    if (isStayUser()) return;
    if (!sequences[activeSeqStage]) sequences[activeSeqStage] = [];
    const maxDay = sequences[activeSeqStage].reduce(
      (m, e) => Math.max(m, Number(e.day) || 0),
      -1
    );
    sequences[activeSeqStage].push({
      id: uid("email"),
      day: maxDay + 1,
      subject: "Νέο email — {{name}}",
      body: `Γεια σου {{name}},\n\nΣχετικά με την {{business}}…\n\nMyReels`,
      enabled: true,
    });
    saveSequences();
    renderSequences();
  }

  function resetSequences() {
    if (isStayUser()) return;
    if (!confirm("Επαναφορά όλων των sequences στα default templates;")) return;
    sequences = cloneDefaults();
    saveSequences();
    renderSequences();
  }

  function openEmailPreview(lead, email) {
    if (isStayUser()) return;
    const subject = personalize(email.subject, lead);
    const body = personalize(email.body, lead);
    previewPayload = { lead, subject, body };

    document.getElementById("email-modal-title").textContent = `Email → ${lead.name}`;
    document.getElementById("email-preview-to").textContent = `Προς: ${lead.email}`;
    document.getElementById("email-preview-subject").value = subject;
    document.getElementById("email-preview-body").value = body;
    btnMailto.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    emailModal.showModal();
  }

  btnAddEmail.addEventListener("click", addEmail);
  btnResetSeq.addEventListener("click", resetSequences);

  btnCopyEmail.addEventListener("click", async () => {
    if (!previewPayload) return;
    const text = `Θέμα: ${previewPayload.subject}\n\n${previewPayload.body}`;
    try {
      await navigator.clipboard.writeText(text);
      btnCopyEmail.textContent = "Αντιγράφηκε";
      setTimeout(() => {
        btnCopyEmail.textContent = "Αντιγραφή";
      }, 1500);
    } catch {
      alert("Δεν ήταν δυνατή η αντιγραφή.");
    }
  });

  /* ─── Lead form ─── */
  form.addEventListener("submit", (e) => {
    const submitter = e.submitter;
    const value = submitter?.value || "cancel";
    if (value === "save") {
      e.preventDefault();
      upsertFromForm();
      modal.close();
    }
  });

  btnSave.addEventListener("click", (e) => {
    if (!form.checkValidity()) {
      e.preventDefault();
      form.reportValidity();
    }
  });

  btnDelete.addEventListener("click", deleteLead);
  btnNew.addEventListener("click", openNew);

  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    renderBoard();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      load();
      renderBoard();
      if (activeTab === "sequences") renderSequences();
      if (activeTab === "onboarding") renderOnboardingTab();
    }
    if (e.key === SEQ_KEY) {
      load();
      if (activeTab === "sequences") renderSequences();
    }
  });

  function renderOnboardingTab() {
    const select = document.getElementById("onboard-lead-select");
    const preview = document.getElementById("onboard-link-preview");
    if (!select || !preview) return;

    const candidates = leads
      .filter((l) => ["accepted", "payment", "send_offer", "waiting"].includes(l.stage))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const current = select.value;
    select.innerHTML =
      `<option value="">— Generic link —</option>` +
      candidates
        .map(
          (l) =>
            `<option value="${l.id}">${escapeHtml(l.name)} · ${escapeHtml(l.business)}</option>`
        )
        .join("");
    if ([...select.options].some((o) => o.value === current)) select.value = current;
    updateOnboardingPreview();
  }

  function updateOnboardingPreview() {
    const select = document.getElementById("onboard-lead-select");
    const preview = document.getElementById("onboard-link-preview");
    if (!select || !preview) return;
    const lead = leads.find((l) => l.id === select.value);
    preview.value = buildOnboardingUrl(lead || null);
  }

  function setupOnboardingTab() {
    const select = document.getElementById("onboard-lead-select");
    const btnGeneric = document.getElementById("btn-copy-onboarding");
    const btnLead = document.getElementById("btn-copy-onboarding-lead");

    select?.addEventListener("change", updateOnboardingPreview);

    btnGeneric?.addEventListener("click", async () => {
      const ok = await copyText(buildOnboardingUrl(null));
      btnGeneric.textContent = ok ? "Αντιγράφηκε ✓" : "Αποτυχία";
      setTimeout(() => {
        btnGeneric.textContent = "Αντιγραφή link";
      }, 1600);
    });

    btnLead?.addEventListener("click", async () => {
      updateOnboardingPreview();
      const preview = document.getElementById("onboard-link-preview");
      const ok = await copyText(preview?.value || buildOnboardingUrl(null));
      btnLead.textContent = ok ? "Αντιγράφηκε ✓" : "Αποτυχία";
      setTimeout(() => {
        btnLead.textContent = "Αντιγραφή personalized link";
      }, 1600);
    });
  }

  const STAY_KEY = "myreels_stay_reels";
  const STAY_COPY_KEY = "myreels_stay_copy_default";

  function loadDefaultCopy() {
    const stay = window.MyReelsStay;
    try {
      const raw = localStorage.getItem(STAY_COPY_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") return stay.normalizePages(parsed);
    } catch {
      /* keep the factory text */
    }
    return stay.normalizePages(null);
  }

  function readStayCopyForm() {
    const stay = window.MyReelsStay;
    const input = {};
    stay.COPY_PAGES.forEach((page) => {
      input[page.id] = {};
      page.fields.forEach((field) => {
        const el = document.getElementById(`stay-copy-${page.id}-${field.key}`);
        input[page.id][field.key] = el ? el.value : "";
      });
    });
    return stay.normalizePages(input);
  }

  function sampleOverrides(pages, defaults) {
    const stay = window.MyReelsStay;
    const current = stay.normalizePages(pages).samples;
    const base = stay.normalizePages(defaults).samples;
    const overrides = {};
    for (let index = 1; index <= 9; index += 1) {
      ["n", "v"].forEach((prefix) => {
        const key = `${prefix}${index}`;
        if (current[key] !== base[key]) overrides[key] = current[key];
      });
    }
    return overrides;
  }

  function copyWithoutSampleOverrides(pages) {
    const stay = window.MyReelsStay;
    const next = stay.normalizePages(pages);
    next.samples = stay.normalizePages(null).samples;
    return next;
  }

  function samplesForItem(item) {
    const stay = window.MyReelsStay;
    const defaults = loadDefaultCopy();
    if (item?.samples && typeof item.samples === "object") return stay.mergeSamples(defaults.samples, item.samples);
    const remote = (stayBoard.deals || []).find((deal) => deal.videoId === item?.videoId)?.samples;
    if (remote && Object.keys(remote).length) return stay.mergeSamples(defaults.samples, remote);
    return stay.mergeSamples(defaults.samples, sampleOverrides(item?.copy, defaults));
  }

  function fillStayCopyForm(copy) {
    const stay = window.MyReelsStay;
    const pages = stay.normalizePages(copy);
    stay.COPY_PAGES.forEach((page) => {
      page.fields.forEach((field) => {
        const el = document.getElementById(`stay-copy-${page.id}-${field.key}`);
        if (el) el.value = pages[page.id][field.key];
      });
    });
  }

  function stayPacks(item) {
    const stay = window.MyReelsStay;
    return {
      p5: stay.parseNet(item?.pack5) ?? stay.PACK_5,
      p10: stay.parseNet(item?.pack10) ?? stay.PACK_10,
    };
  }

  function withStaySlugs(items) {
    const stay = window.MyReelsStay;
    const next = items.map((item) => ({ ...item }));
    const taken = [];
    const ordered = [...next].sort((a, b) => Number(Boolean(b.slug)) - Number(Boolean(a.slug)));
    ordered.forEach((item) => {
      const cleaned = item.slug ? stay.slugify(item.slug) : "";
      const slug = cleaned && !taken.includes(cleaned) ? cleaned : stay.landingSlug(item.name, taken);
      item.slug = slug;
      taken.push(slug);
    });
    return next;
  }

  function stayLandingUrl(item) {
    const stay = window.MyReelsStay;
    return stay.buildLandingUrl(window.location.origin, item.slug || stay.landingSlug(item.name, []));
  }

  function loadStays() {
    try {
      const raw = localStorage.getItem(STAY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveStays(items) {
    localStorage.setItem(STAY_KEY, JSON.stringify(items));
  }

  function renderStayList() {
    const list = document.getElementById("stay-list");
    if (!list || !window.MyReelsStay) return;
    const loaded = loadStays();
    const items = withStaySlugs(loaded);
    if (JSON.stringify(items.map((item) => item.slug)) !== JSON.stringify(loaded.map((item) => item.slug))) {
      saveStays(items);
    }
    if (!items.length) {
      list.innerHTML = `<p class="stay-hint">Δεν έχεις δημιουργήσει landing ακόμα.</p>`;
      return;
    }
    list.innerHTML = items
      .map((item) => {
        const net = window.MyReelsStay.parseNet(item.net) ?? window.MyReelsStay.NET;
        const packs = stayPacks(item);
        const grossLabel = window.MyReelsStay.euro(window.MyReelsStay.grossOf(net));
        const gross5 = window.MyReelsStay.euro(window.MyReelsStay.grossOf(packs.p5));
        const gross10 = window.MyReelsStay.euro(window.MyReelsStay.grossOf(packs.p10));
        const url = stayLandingUrl(item);
        const driveHref = window.MyReelsStay.driveFileUrl(item.driveId);
        const youtubeHref = item.youtubeUrl || `https://youtu.be/${item.videoId}`;
        const when = new Date(item.createdAt).toLocaleString("el-GR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `
          <article class="stay-row">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(when)} · 1: ${escapeHtml(grossLabel)} · 5: ${escapeHtml(gross5)} · 10: ${escapeHtml(gross10)}${item.mobile === "b" ? " · Κινητό Β" : ""}</small>
              <span class="stay-row__links">
                <a href="${escapeHtml(youtubeHref)}" target="_blank" rel="noopener" title="YouTube — στη landing" aria-label="YouTube, στη landing">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#FF0000"/><path fill="#fff" d="M10 8.2v7.6l6.4-3.8L10 8.2z"/></svg>
                </a>
                ${
                  driveHref
                    ? `<a href="${escapeHtml(driveHref)}" target="_blank" rel="noopener" title="Google Drive — στον αγοραστή" aria-label="Google Drive, στον αγοραστή">
                  <svg viewBox="0 0 87.3 78" aria-hidden="true"><path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z"/><path fill="#00ac47" d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"/><path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z"/><path fill="#00832d" d="M43.65 25 57.4 1.2c-1.35-.8-2.9-1.2-4.5-1.2H34.4c-1.6 0-3.15.45-4.5 1.2z"/><path fill="#2684fc" d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"/><path fill="#ffba00" d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z"/></svg>
                </a>`
                    : ""
                }
              </span>
            </div>
            <div class="stay-row__actions">
              <a class="btn btn--sm" href="${escapeHtml(url)}" target="_blank" rel="noopener">Άνοιγμα</a>
              <button type="button" class="btn btn--ghost btn--sm" data-stay-edit="${escapeHtml(item.id)}">Επεξεργασία</button>
              <button type="button" class="btn btn--ghost btn--sm" data-stay-copy="${escapeHtml(url)}">Αντιγραφή</button>
              <button type="button" class="btn btn--ghost btn--sm btn--danger" data-stay-delete="${escapeHtml(item.id)}">Διαγραφή</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function showStayResult(item) {
    const stay = window.MyReelsStay;
    const box = document.getElementById("stay-result");
    const empty = document.getElementById("stay-empty-result");
    const nameEl = document.getElementById("stay-result-name");
    const urlEl = document.getElementById("stay-result-url");
    const driveEl = document.getElementById("stay-result-drive");
    const openEl = document.getElementById("stay-open");
    if (!box || !stay) return;
    const net = stay.parseNet(item.net) ?? stay.NET;
    const url = stayLandingUrl(item);
    if (empty) empty.hidden = true;
    box.hidden = false;
    if (nameEl) nameEl.textContent = `${item.name} · ${stay.euro(stay.grossOf(net))}`;
    if (urlEl) urlEl.value = url;
    if (driveEl) driveEl.value = stay.driveFileUrl(item.driveId);
    if (openEl) openEl.href = url;
  }

  const STAY_STAGE_META = [
    { id: "landing", label: "Landing", hint: "Μόλις φτιάχνεται η σελίδα" },
    { id: "bought", label: "Αγόρασε το Reel", hint: "Κανένα βήμα, έφτασε στα 10, έφτασε στα 5, ή skip και στις 2" },
    { id: "pack5", label: "Πακέτο 5", hint: "5 Reels συνολικά. Το tag λέει αν πέρασε από τα 10." },
    { id: "pack10", label: "Πακέτο 10", hint: "10 Reels και διαχείριση social για 2 μήνες" },
  ];
  const STAY_BOARD_STAGES = [
    ...STAY_STAGE_META,
    { id: "out", label: "Δεν ενδιαφέρεται", hint: "Έφυγε από το Landing." },
  ];
  let stayBoard = { deals: [], sequences: {} };
  let staySeqStage = "landing";
  let stayPick = new Set();
  let stayOpen = "";
  let stayQuery = "";
  let stayFocus = "landing";

  function setStayBoardStatus(message) {
    const status = document.getElementById("stay-board-status");
    if (status) status.textContent = message || "";
    const seq = document.getElementById("stay-seq-status");
    if (seq && message) seq.textContent = message;
    const reviews = document.getElementById("stay-review-status");
    if (reviews && message) reviews.textContent = message;
  }

  async function stayBoardRequest(payload) {
    const response = await fetch("/api/stay-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...sessionCreds() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Το pipeline δεν φορτώθηκε.");
    }
    return data;
  }

  function applyStayBoard(data) {
    stayBoard = {
      deals: data.deals || [],
      sequences: data.sequences || {},
      reviews: data.reviews || [],
      payments: data.payments || [],
    };
    const known = new Set((stayBoard.deals || []).map((deal) => deal.videoId));
    stayPick = new Set([...stayPick].filter((id) => known.has(id)));
    if (stayOpen && !known.has(stayOpen)) stayOpen = "";
    renderStayPipeline();
    renderStaySequences();
    renderStayReviews();
    paintStaySheet();
  }

  async function loadStayBoard() {
    setStayBoardStatus("");
    try {
      const loaded = await stayBoardRequest({ action: "load" });
      if (window.MyReelsStay && loaded.copy) {
        const pages = window.MyReelsStay.resolvePages(loaded.copy);
        localStorage.setItem(STAY_COPY_KEY, JSON.stringify(pages));
        fillStayCopyForm(pages);
      }
      const stay = window.MyReelsStay;
      const stays = withStaySlugs(loadStays());
      saveStays(stays);
      const deals = stays.filter((item) => item.videoId).map((item) => {
        const deal = {
          videoId: item.videoId,
          property: item.name,
          net: stay?.parseNet(item.net) ?? stay?.NET,
          pack5: stay?.parseNet(item.pack5) ?? stay?.PACK_5,
          pack10: stay?.parseNet(item.pack10) ?? stay?.PACK_10,
          slug: item.slug,
          copy: stay?.encodeCopy(item.copy ? copyWithoutSampleOverrides(item.copy) : null) || "",
          landingUrl: stayLandingUrl(item),
          driveUrl: item.driveUrl || stay?.driveFileUrl(item.driveId),
          createdAt: new Date(item.createdAt).toISOString(),
        };
        if (item.posterAt != null) deal.posterAt = item.posterAt;
        if (item.mobile === "a" || item.mobile === "b") deal.mobile = item.mobile;
        if (item.samples && typeof item.samples === "object") deal.samples = item.samples;
        return deal;
      });
      const seeded = await stayBoardRequest({ action: "seed", deals });
      applyStayBoard(seeded);
    } catch (err) {
      setStayBoardStatus(err?.message || "Το pipeline δεν φορτώθηκε.");
    }
  }

  function publicBuyerName(name, hide) {
    const clean = String(name || "").trim().replace(/\s+/g, " ");
    if (!hide || !clean) return clean;
    const parts = clean.split(" ");
    if (parts.length < 2) return clean;
    return `${parts.slice(0, -1).join(" ")} ${parts[parts.length - 1].charAt(0).toLocaleUpperCase("el-GR")}.`;
  }

  function renderStayReviews() {
    const root = document.getElementById("stay-reviews");
    const tab = document.querySelector('[data-stay-tab="reviews"]');
    if (!root) return;
    const reviews = (stayBoard.reviews || []).slice().sort((a, b) => {
      const rank = { pending: 0, approved: 1, rejected: 2 };
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || String(b.createdAt).localeCompare(String(a.createdAt));
    });
    const pending = reviews.filter((item) => item.status === "pending").length;
    if (tab) tab.textContent = pending ? `Κριτικές (${pending})` : "Κριτικές";
    if (!reviews.length) {
      root.innerHTML = `<p class="stay-hint">Καμία κριτική ακόμα. Η φόρμα φεύγει με το email του αρχείου.</p>`;
      return;
    }
    const statusLabel = { pending: "ΑΝΑΜΟΝΗ", approved: "ΣΤΗΝ ΙΣΤΟΣΕΛΙΔΑ", rejected: "ΑΠΟΡΡΙΦΘΗΚΕ" };
    root.innerHTML = reviews
      .map((item) => {
        const shown = publicBuyerName(item.buyerName, item.hideName) || "Χωρίς όνομα";
        const stars = Array.from({ length: 5 }, (_, index) => `<span class="${index < item.stars ? "is-on" : ""}">★</span>`).join("");
        const approve = item.status === "approved" ? "" : `<button type="button" class="btn btn--approve" data-review-status="approved" data-review-id="${escapeHtml(item.id)}">Έγκριση για ιστοσελίδα</button>`;
        const reject = item.status === "rejected" ? "" : `<button type="button" class="btn btn--reject" data-review-status="rejected" data-review-id="${escapeHtml(item.id)}">Απόρριψη</button>`;
        return `
          <article class="stay-review">
            <div class="stay-review__top">
              <span class="stay-review__stars" aria-label="${item.stars} από 5">${stars}</span>
              <span class="stay-review__status is-${escapeHtml(item.status)}">${statusLabel[item.status] || "ΑΝΑΜΟΝΗ"}</span>
            </div>
            <strong>${escapeHtml(item.buyerName || "Χωρίς ονοματεπώνυμο")}${item.email ? ` · ${escapeHtml(item.email)}` : ""}</strong>
            <small>Δημόσια εμφάνιση: ${escapeHtml(shown)}${item.property ? ` · ${escapeHtml(item.property)}` : ""}</small>
            ${item.message ? `<blockquote class="stay-review__quote">“${escapeHtml(item.message)}”</blockquote>` : ""}
            <div class="stay-review__actions">${approve}${reject}</div>
          </article>`;
      })
      .join("");
  }

  function funnelTag(deal) {
    if (deal.stage !== "bought") return "";
    if (deal.funnel === "1" || deal.skipped) return `<span class="stay-tag">Skip και στις 2</span>`;
    if (deal.funnel === "5") return `<span class="stay-tag stay-tag--mid">Έφτασε στα 5</span>`;
    if (deal.funnel === "10") return `<span class="stay-tag stay-tag--mid">Έφτασε στα 10</span>`;
    return `<span class="stay-tag stay-tag--quiet">Κανένα βήμα</span>`;
  }

  function tenTag(deal) {
    if (deal.stage !== "pack5") return "";
    if (deal.sawTen) return `<span class="stay-tag stay-tag--mid">Πήγε στα 10</span>`;
    return `<span class="stay-tag stay-tag--quiet">Δεν πήγε στα 10</span>`;
  }

  function reviewTag(deal) {
    if (deal.stage === "landing") return "";
    if (deal.reviewed) return `<span class="stay-tag stay-tag--yes">Έκανε κριτική</span>`;
    return `<span class="stay-tag stay-tag--quiet">Χωρίς κριτική</span>`;
  }

  function viberPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (/^69\d{8}$/.test(digits)) return `30${digits}`;
    if (/^3069\d{8}$/.test(digits)) return digits;
    return "";
  }

  function viberButton(deal) {
    if (deal.stage === "landing" || deal.stage === "out" || deal.reviewed) return "";
    const phone = viberPhone(deal.phone);
    if (!phone) return "";
    return `<button type="button" class="btn btn--viber" data-viber-phone="${escapeHtml(phone)}" data-viber-name="${escapeHtml(deal.buyerName || "")}" data-viber-property="${escapeHtml(deal.property || "")}" data-viber-token="${escapeHtml(deal.reviewToken || "")}" data-viber-video="${escapeHtml(deal.videoId || "")}">Στείλε στο Viber</button>`;
  }

  function stayDealName(videoId) {
    return (stayBoard.deals || []).find((deal) => deal.videoId === videoId)?.property || "τη σελίδα";
  }

  function stayMoney(amount) {
    const value = Number(amount);
    if (!value) return "";
    const digits = Math.round(value * 100) % 100 === 0 ? 0 : 2;
    return `${new Intl.NumberFormat("el-GR", { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(value)}€`;
  }

  function stayWhen(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("el-GR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function stayCard(deal) {
    const id = escapeHtml(deal.videoId || "");
    const name = escapeHtml(deal.property || "Χωρίς όνομα");
    const picked = stayPick.has(deal.videoId) ? " checked" : "";
    return `
      <article class="stay-card is-${escapeHtml(deal.stage || "landing")}">
        <div class="stay-card__head">
          <input type="checkbox" data-stay-pick="${id}" aria-label="Επιλογή ${name}"${picked} />
          <button type="button" class="stay-card__name" data-stay-open="${id}">${name}</button>
        </div>
        <textarea class="stay-card__note" rows="2" data-stay-note="${id}" placeholder="Σημείωση">${escapeHtml(deal.note || "")}</textarea>
      </article>`;
  }

  function stayFill(text, deal) {
    const property = deal.property || "";
    const name = deal.buyerName || "";
    return String(text || "")
      .replaceAll("{property}", property)
      .replaceAll("{name}", name)
      .replaceAll("{hello}", name ? `Γεια σου ${name}` : "Γεια σου");
  }

  function stayMailRows(deal) {
    const sent = deal.sent && typeof deal.sent === "object" ? deal.sent : {};
    const known = new Map();
    STAY_STAGE_META.forEach((stage) => {
      (stayBoard.sequences?.[stage.id] || []).forEach((email) => {
        known.set(email.id, { subject: stayFill(email.subject, deal), stage: stage.label });
      });
    });
    return Object.entries(sent)
      .map(([id, at]) => ({
        subject: known.get(id)?.subject || "Email",
        stage: known.get(id)?.stage || "",
        at: String(at || ""),
      }))
      .sort((a, b) => a.at.localeCompare(b.at));
  }

  function stayPayRows(deal) {
    const labels = { reel: "Πρώτο Reel", pack5: "Πακέτο 5", pack10: "Πακέτο 10" };
    const status = { paid: "Πληρώθηκε", pending: "Εκκρεμεί", failed: "Απέτυχε" };
    return (stayBoard.payments || [])
      .filter((item) => item.videoId === deal.videoId || (deal.property && item.property === deal.property))
      .map((item) => ({
        label: labels[item.kind] || "Πληρωμή",
        status: status[item.status] || "Εκκρεμεί",
        amount: stayMoney(item.amountCents / 100),
        when: stayWhen(item.paidAt || item.createdAt),
        document: item.document === "invoice" ? `Τιμολόγιο${item.afm ? ` · ΑΦΜ ${item.afm}` : ""}` : "Απόδειξη",
      }));
  }

  function staySheet(deal) {
    const id = escapeHtml(deal.videoId || "");
    const name = escapeHtml(deal.property || "Χωρίς όνομα");
    const archived = deal.archived === true;
    const stage = STAY_BOARD_STAGES.find((item) => item.id === deal.stage);
    const mails = stayMailRows(deal);
    const pays = stayPayRows(deal);
    const vibers = Array.isArray(deal.viberAt) ? deal.viberAt : [];
    const tools = archived
      ? `<button type="button" class="btn btn--ghost btn--sm" data-stay-restore="${id}" data-stay-property="${name}">Επαναφορά</button>`
      : `<button type="button" class="btn btn--ghost btn--sm" data-stay-archive="${id}" data-stay-property="${name}">Αρχειοθέτηση</button>`;
    const moves = !archived && deal.stage === "landing"
      ? `<div class="stay-card__move">
          <button type="button" class="btn btn--ghost btn--sm" data-stay-move="bought" data-stay-video="${id}" data-stay-property="${name}">Αγόρασε το Reel</button>
          <button type="button" class="btn btn--ghost btn--sm" data-stay-move="pack5" data-stay-video="${id}" data-stay-property="${name}">Πακέτο 5</button>
          <button type="button" class="btn btn--ghost btn--sm" data-stay-move="pack10" data-stay-video="${id}" data-stay-property="${name}">Πακέτο 10</button>
          <button type="button" class="btn btn--ghost btn--sm" data-stay-move="out" data-stay-video="${id}" data-stay-property="${name}">Δεν ενδιαφέρεται</button>
        </div>`
      : "";
    const invoice = deal.document === "invoice";
    return `
      <header class="stay-sheet__head">
        <h2>${name}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-stay-close>Κλείσιμο</button>
      </header>
      <p class="stay-hint">${escapeHtml(stage?.label || "")}${archived ? " · Αρχείο" : ""}</p>
      <div class="stay-card__tags">${funnelTag(deal)}${tenTag(deal)}${reviewTag(deal)}</div>
      <form class="stay-edit" data-stay-edit="${id}">
        <label>Κατάλυμα<input name="property" maxlength="80" required value="${name}" /></label>
        <label>Όνομα<input name="buyerName" maxlength="120" value="${escapeHtml(deal.buyerName || "")}" /></label>
        <label>Email<input name="email" maxlength="160" inputmode="email" autocomplete="off" value="${escapeHtml(deal.email || "")}" /></label>
        <label>Τηλέφωνο<input name="phone" maxlength="20" inputmode="tel" autocomplete="off" value="${escapeHtml(deal.phone || "")}" /></label>
        <div class="stay-edit__prices">
          <label>1ο Reel<input name="net" inputmode="decimal" value="${deal.net ? escapeHtml(String(deal.net)) : ""}" /></label>
          <label>Πακέτο 5<input name="pack5" inputmode="decimal" value="${deal.pack5 ? escapeHtml(String(deal.pack5)) : ""}" /></label>
          <label>Πακέτο 10<input name="pack10" inputmode="decimal" value="${deal.pack10 ? escapeHtml(String(deal.pack10)) : ""}" /></label>
        </div>
        <label>Drive<input name="driveUrl" inputmode="url" placeholder="https://drive.google.com/…" value="${escapeHtml(deal.driveUrl || "")}" /></label>
        <label>Παραστατικό
          <select name="document">
            <option value=""${deal.document ? "" : " selected"}>Χωρίς</option>
            <option value="receipt"${deal.document === "receipt" ? " selected" : ""}>Απόδειξη</option>
            <option value="invoice"${invoice ? " selected" : ""}>Τιμολόγιο</option>
          </select>
        </label>
        <div class="stay-edit__invoice"${invoice ? "" : " hidden"}>
          <label>ΑΦΜ<input name="afm" inputmode="numeric" maxlength="9" value="${escapeHtml(deal.afm || "")}" /></label>
          <label>Επωνυμία<input name="companyName" maxlength="200" value="${escapeHtml(deal.companyName || "")}" /></label>
          <label>Διακριτικός<input name="companyTitle" maxlength="120" value="${escapeHtml(deal.companyTitle || "")}" /></label>
          <label>Διεύθυνση<input name="companyAddress" maxlength="300" value="${escapeHtml(deal.companyAddress || "")}" /></label>
        </div>
        <label>Σημείωση<textarea name="note" rows="3" maxlength="500" placeholder="Σημείωση">${escapeHtml(deal.note || "")}</textarea></label>
        ${deal.landingUrl ? `<p class="stay-hint"><a href="${escapeHtml(deal.landingUrl)}" target="_blank" rel="noopener">Άνοιγμα σελίδας</a></p>` : ""}
        <button type="submit" class="btn">Αποθήκευση</button>
      </form>
      <h3>Πληρωμές</h3>
      ${pays.length ? `<ul class="stay-sheet__list">${pays.map((item) => `<li><strong>${escapeHtml(item.label)}</strong> ${escapeHtml(item.amount)} · ${escapeHtml(item.status)}<small>${escapeHtml(item.when)} · ${escapeHtml(item.document)}</small></li>`).join("")}</ul>` : `<p class="stay-hint">Καμία πληρωμή ακόμα.</p>`}
      <h3>Emails</h3>
      ${mails.length ? `<ul class="stay-sheet__list">${mails.map((item) => `<li><strong>${escapeHtml(item.subject)}</strong><small>${escapeHtml(item.stage)}${item.stage ? " · " : ""}${escapeHtml(stayWhen(item.at))}</small></li>`).join("")}</ul>` : `<p class="stay-hint">Κανένα email ακόμα.</p>`}
      <h3>Viber</h3>
      ${vibers.length ? `<ul class="stay-sheet__list">${vibers.map((at) => `<li><strong>Στάλθηκε μήνυμα</strong><small>${escapeHtml(stayWhen(at))}</small></li>`).join("")}</ul>` : `<p class="stay-hint">Δεν έχει καταγραφεί αποστολή.</p>`}
      ${viberButton(deal)}
      ${moves}
      <div class="stay-card__tools">${tools}<button type="button" class="btn btn--ghost btn--sm btn--danger" data-stay-remove="${id}" data-stay-property="${name}">Διαγραφή</button></div>`;
  }

  function paintStaySheet() {
    const sheet = document.getElementById("stay-sheet");
    const body = document.getElementById("stay-sheet-body");
    if (!sheet || !body) return;
    const deal = (stayBoard.deals || []).find((item) => item.videoId === stayOpen);
    if (!deal) {
      sheet.hidden = true;
      return;
    }
    body.innerHTML = staySheet(deal);
    sheet.hidden = false;
  }

  function paintPick() {
    const count = document.getElementById("stay-pick-count");
    const archive = document.getElementById("stay-bulk-archive");
    const remove = document.getElementById("stay-delete-picked");
    const all = document.getElementById("stay-pick-all");
    const ids = [...stayPick];
    if (count) count.textContent = ids.length === 1 ? "1 επιλεγμένο" : `${ids.length} επιλεγμένα`;
    if (archive) archive.disabled = ids.length === 0;
    if (remove) remove.disabled = ids.length === 0;
    const visible = [...document.querySelectorAll("#stay-board [data-stay-pick], #stay-archive [data-stay-pick]")];
    if (all) {
      all.checked = visible.length > 0 && visible.every((box) => box.checked);
      all.indeterminate = !all.checked && visible.some((box) => box.checked);
    }
  }

  function stayHit(deal, query) {
    if (!query) return true;
    const text = [deal.property, deal.buyerName, deal.email, deal.phone, deal.note, deal.afm, deal.companyName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (text.includes(query)) return true;
    const digits = query.replace(/\D/g, "");
    const phone = String(deal.phone || "").replace(/\D/g, "");
    return digits.length >= 3 && phone.includes(digits);
  }

  function renderStayPipeline() {
    const board = document.getElementById("stay-board");
    if (!board) return;
    const query = stayQuery.trim().toLowerCase();
    const narrow = document.body.classList.contains("is-stay-narrow");
    const deals = stayBoard.deals || [];
    const active = deals.filter((deal) => !deal.archived && stayHit(deal, query));
    const stages = !query && narrow
      ? STAY_BOARD_STAGES.filter((stage) => stage.id === stayFocus)
      : STAY_BOARD_STAGES;
    const short = { landing: "Landing", bought: "Reel", pack5: "5", pack10: "10", out: "Όχι" };
    const chips = document.getElementById("stay-stages");
    if (chips) {
      chips.innerHTML = STAY_BOARD_STAGES.map((stage) => {
        const count = deals.filter((deal) => !deal.archived && deal.stage === stage.id).length;
        const on = stage.id === stayFocus ? " is-active" : "";
        return `<button type="button" class="stay-stage${on}" data-stay-focus="${escapeHtml(stage.id)}">${escapeHtml(short[stage.id] || stage.label)} <span>${count}</span></button>`;
      }).join("");
    }
    board.classList.toggle("is-searching", Boolean(query));
    const columns = stages
      .map((stage) => {
        const cards = active.filter((deal) => deal.stage === stage.id);
        if (query && !cards.length) return "";
        const body = cards.length
          ? cards.map((deal) => stayCard(deal)).join("")
          : `<p class="stay-hint">Κανένα ακόμα</p>`;
        return `<section class="stay-col is-${escapeHtml(stage.id)}${stage.id === stayFocus ? " is-current" : ""}"><h2>${escapeHtml(stage.label)} <span class="stay-count">${cards.length}</span></h2><p class="stay-hint">${escapeHtml(stage.hint)}</p>${body}</section>`;
      })
      .filter(Boolean)
      .join("");
    board.innerHTML = columns || `<p class="stay-hint">Τίποτα με αυτό.</p>`;
    const archivedAll = deals.filter((deal) => deal.archived);
    const archived = archivedAll.filter((deal) => stayHit(deal, query));
    const drawer = document.getElementById("stay-archive");
    const toggle = document.getElementById("stay-archive-toggle");
    if (toggle) toggle.textContent = `Αρχείο (${archivedAll.length})`;
    if (drawer) {
      drawer.hidden = Boolean(query) && archived.length === 0;
      drawer.innerHTML = `
        <h2>Αρχείο <span class="stay-count">${archived.length}</span></h2>
        <p class="stay-hint">Ό,τι αρχειοθετείς εμφανίζεται εδώ, κάτω από τις στήλες.</p>
        <div class="stay-archive__grid">${archived.length ? archived.map((deal) => stayCard(deal, true)).join("") : `<p class="stay-hint">Κανένα ακόμα</p>`}</div>`;
    }
    paintPick();
  }

  function readSeqForm() {
    if (!stayBoard.sequences) stayBoard.sequences = {};
    const cards = document.querySelectorAll("#stay-seq-editor [data-seq-index]");
    if (!cards.length && !(stayBoard.sequences[staySeqStage] || []).length) return;
    const current = stayBoard.sequences[staySeqStage] || [];
    const list = [];
    cards.forEach((card, index) => {
      list.push({
        id: current[index]?.id || `mail-${Date.now()}-${index}`,
        day: Number(card.querySelector("[data-seq-day]")?.value) || 0,
        subject: card.querySelector("[data-seq-subject]")?.value || "",
        body: card.querySelector("[data-seq-body]")?.value || "",
        active: Boolean(card.querySelector("[data-seq-active]")?.checked),
      });
    });
    if (cards.length) stayBoard.sequences[staySeqStage] = list;
  }

  function renderStaySequences() {
    const stages = document.getElementById("stay-seq-stages");
    const editor = document.getElementById("stay-seq-editor");
    if (!stages || !editor) return;
    stages.innerHTML = STAY_STAGE_META.map((stage) => {
      const count = (stayBoard.sequences?.[stage.id] || []).length;
      const active = stage.id === staySeqStage ? " is-active" : "";
      return `<button type="button" class="stay-subtab${active}" data-seq-stage="${stage.id}">${escapeHtml(stage.label)} <small>${count}</small></button>`;
    }).join("");
    stages.querySelectorAll("[data-seq-stage]").forEach((button) => {
      button.addEventListener("click", () => {
        readSeqForm();
        staySeqStage = button.dataset.seqStage;
        renderStaySequences();
      });
    });
    const emails = stayBoard.sequences?.[staySeqStage] || [];
    editor.innerHTML = `
      <div class="stay-seq__bar">
        <button type="button" class="btn" id="stay-seq-save">Αποθήκευση</button>
        <button type="button" class="btn btn--ghost" id="stay-seq-add">+ Email</button>
        <button type="button" class="btn btn--ghost" id="stay-seq-reset">Επαναφορά</button>
        <label class="field stay-seq__to">
          <span>Δοκιμή στο</span>
          <input type="email" id="stay-seq-test-email" placeholder="το email σου" autocomplete="email" value="${escapeHtml(sessionStorage.getItem("myreels_seq_test_to") || "")}" />
        </label>
      </div>
      <p class="stay-hint" id="stay-seq-status">Ημέρα 0 φεύγει μόνη της μόλις το κατάλυμα μπει στο στάδιο και έχουμε email. Οι επόμενες μέρες φεύγουν μόνες τους.</p>
      <details class="stay-details">
        <summary>Μεταβλητές</summary>
      <div class="stay-tokens-wrap">
        <table class="stay-tokens">
          <thead>
            <tr><th>Μεταβλητή</th><th>Τι μπαίνει</th><th>Παράδειγμα</th></tr>
          </thead>
          <tbody>
            <tr><td><code>{hello}</code></td><td>Χαιρετισμός. Με ονοματεπώνυμο γίνεται «Γεια σου» και το όνομα. Χωρίς όνομα μένει «Γεια σου».</td><td>Γεια σου Μαρία Γεωργίου</td></tr>
            <tr><td><code>{name}</code></td><td>Ονοματεπώνυμο αγοραστή.</td><td>Μαρία Γεωργίου</td></tr>
            <tr><td><code>{property}</code></td><td>Όνομα καταλύματος.</td><td>Ηλιοπετρόσπιτο</td></tr>
            <tr><td><code>{email}</code></td><td>Email αγοραστή.</td><td>maria@example.com</td></tr>
            <tr><td><code>{phone}</code></td><td>Τηλέφωνο αγοραστή.</td><td>6900000000</td></tr>
            <tr><td><code>{net}</code></td><td>Τιμή του 1ου Reel, χωρίς ΦΠΑ.</td><td>40€</td></tr>
            <tr><td><code>{pack5}</code></td><td>Τιμή των 5 Reels, χωρίς ΦΠΑ.</td><td>170€</td></tr>
            <tr><td><code>{pack10}</code></td><td>Τιμή των 10 Reels, χωρίς ΦΠΑ.</td><td>350€</td></tr>
            <tr><td><code>{drive}</code></td><td>Link του αρχείου στο Google Drive. Μπαίνει από τη landing.</td><td>https://drive.google.com/file/d/…/view</td></tr>
            <tr><td><code>{review}</code></td><td>Η φόρμα κριτικής. Μπαίνει σε κάθε email μετά την αγορά, μέχρι να τη στείλει. Από το επόμενο email και μετά δεν ξαναμπαίνει.</td><td>Αν δεν μας έγραψες ακόμα δύο λόγια… και το link της φόρμας</td></tr>
          </tbody>
        </table>
      </div>
      </details>
      ${
        emails
          .map(
            (email, index) => `
            <article class="stay-seq__card" data-seq-index="${index}">
              <label class="field"><span>Ημέρα</span><input type="number" min="0" max="60" data-seq-day value="${Number(email.day) || 0}" /></label>
              <label class="field"><span>Θέμα</span><input type="text" data-seq-subject value="${escapeHtml(email.subject)}" /></label>
              <label class="field"><span>Κείμενο</span><textarea rows="7" data-seq-body>${escapeHtml(email.body)}</textarea></label>
              <label class="stay-seq__active"><input type="checkbox" data-seq-active ${email.active !== false ? "checked" : ""} /> Ενεργό</label>
              <div class="stay-result__actions">
                <button type="button" class="btn btn--ghost" data-seq-test>Δοκιμή</button>
                <button type="button" class="btn btn--ghost" data-seq-send="${escapeHtml(email.id)}">Στείλε σε όσους είναι εδώ</button>
                <button type="button" class="btn btn--ghost btn--danger" data-seq-delete>Διαγραφή</button>
              </div>
              <div class="stay-seq__preview" data-seq-preview hidden></div>
            </article>`
          )
          .join("") || `<p class="stay-hint">Κανένα email σε αυτό το στάδιο.</p>`
      }`;
    document.getElementById("stay-seq-test-email")?.addEventListener("input", (event) => {
      sessionStorage.setItem("myreels_seq_test_to", event.target.value.trim());
    });
    document.getElementById("stay-seq-add")?.addEventListener("click", () => {
      readSeqForm();
      stayBoard.sequences[staySeqStage] = stayBoard.sequences[staySeqStage] || [];
      stayBoard.sequences[staySeqStage].push({
        id: `mail-${Date.now()}`,
        day: 0,
        active: true,
        subject: "Νέο email για το {property}",
        body: "{hello},\n\n",
      });
      renderStaySequences();
    });
    document.getElementById("stay-seq-save")?.addEventListener("click", async () => {
      readSeqForm();
      setStayBoardStatus("Αποθήκευση…");
      try {
        applyStayBoard(await stayBoardRequest({ action: "sequences", sequences: stayBoard.sequences }));
        setStayBoardStatus("Τα emails αποθηκεύτηκαν.");
      } catch (err) {
        setStayBoardStatus(err?.message || "Δεν αποθηκεύτηκαν.");
      }
    });
    document.getElementById("stay-seq-reset")?.addEventListener("click", async () => {
      if (!confirm("Να γυρίσουν όλα τα emails στο έτοιμο κείμενο;")) return;
      try {
        applyStayBoard(await stayBoardRequest({ action: "resetSequences" }));
        setStayBoardStatus("Γύρισαν τα έτοιμα emails.");
      } catch (err) {
        setStayBoardStatus(err?.message || "Δεν έγινε επαναφορά.");
      }
    });
    editor.querySelectorAll("[data-seq-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-seq-index]");
        const index = Number(card?.dataset.seqIndex);
        readSeqForm();
        stayBoard.sequences[staySeqStage] = (stayBoard.sequences[staySeqStage] || []).filter((_, i) => i !== index);
        renderStaySequences();
      });
    });
    editor.querySelectorAll("[data-seq-test]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-seq-index]");
        const to = document.getElementById("stay-seq-test-email")?.value.trim() || "";
        sessionStorage.setItem("myreels_seq_test_to", to);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          setStayBoardStatus("Γράψε το email που θα λάβει τη δοκιμή.");
          return;
        }
        const subject = card?.querySelector("[data-seq-subject]")?.value || "";
        const text = card?.querySelector("[data-seq-body]")?.value || "";
        button.disabled = true;
        try {
          const result = await stayBoardRequest({ action: "test", to, subject, body: text, stage: staySeqStage });
          const box = card?.querySelector("[data-seq-preview]");
          if (box) {
            box.hidden = false;
            box.innerHTML = `<strong>${escapeHtml(result.subject || "")}</strong>${escapeHtml(result.text || "")}`;
          }
          setStayBoardStatus(result.sent ? `Έφυγε δοκιμή στο ${to}.` : "Η προεπισκόπηση είναι έτοιμη. Από εδώ δεν φεύγει email.");
        } catch (err) {
          setStayBoardStatus(err?.message || "Η δοκιμή δεν έφυγε.");
        }
        button.disabled = false;
      });
    });
    editor.querySelectorAll("[data-seq-send]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Να σταλεί αυτό το email σε όσα καταλύματα είναι σε αυτό το στάδιο και δεν το έχουν πάρει;")) return;
        readSeqForm();
        button.disabled = true;
        try {
          await stayBoardRequest({ action: "sequences", sequences: stayBoard.sequences });
          const result = await stayBoardRequest({
            action: "send",
            stage: staySeqStage,
            emailId: button.getAttribute("data-seq-send"),
          });
          applyStayBoard(result);
          setStayBoardStatus(result.sent ? `Έφυγαν ${result.sent}.` : "Κανένας σε αυτό το στάδιο δεν είχε email, ή το είχε ήδη πάρει.");
        } catch (err) {
          setStayBoardStatus(err?.message || "Δεν στάλθηκε.");
          button.disabled = false;
        }
      });
    });
  }

  let stayLeads = { leads: [], moves: [], canWrite: false };

  function setStayLeadsStatus(message) {
    const status = document.getElementById("stay-leads-status");
    if (status) status.textContent = message || "";
  }

  function leadMeta(lead) {
    return [lead.region, lead.channel, lead.email, lead.phone].filter(Boolean).join(" · ");
  }

  function renderStayLeads() {
    const queue = document.getElementById("stay-lead-queue");
    const all = document.getElementById("stay-lead-all");
    const moves = document.getElementById("stay-lead-moves");
    const queued = stayLeads.leads
      .filter((lead) => lead.status === "Στην ουρά")
      .sort((left, right) => (Number(left.order) || 9999) - (Number(right.order) || 9999));
    if (queue) {
      queue.innerHTML = queued.length
        ? queued
            .map(
              (lead) => `<article class="stay-row">
                <div>
                  <strong>${lead.order ? `${escapeHtml(lead.order)}. ` : ""}${escapeHtml(lead.name)}</strong>
                  <small>${escapeHtml(leadMeta(lead) || "Χωρίς στοιχεία επικοινωνίας")}</small>
                </div>
                <button type="button" class="btn btn--ghost" data-lead-sent="${escapeHtml(lead.name)}">Στάλθηκε</button>
              </article>`
            )
            .join("")
        : `<p class="stay-hint">Η ουρά είναι άδεια. Νέα επαφή μπαίνει εδώ.</p>`;
    }
    if (all) {
      all.innerHTML = stayLeads.leads.length
        ? stayLeads.leads
            .map((lead) => {
              const href = /^https?:\/\//i.test(lead.link) ? lead.link : "";
              const site = href
                ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(href.replace(/^https?:\/\//, ""))}</a>`
                : "";
              return `<article class="stay-row">
                <div>
                  <strong>${escapeHtml(lead.name)}</strong>
                  <small>${escapeHtml([lead.status || "Νέο", leadMeta(lead)].filter(Boolean).join(" · "))}</small>
                  ${site ? `<div class="stay-row__links">${site}</div>` : ""}
                </div>
              </article>`;
            })
            .join("")
        : `<p class="stay-hint">Δεν υπάρχουν επαφές στο Sheet.</p>`;
    }
    if (moves) {
      const recent = stayLeads.moves.slice().reverse().slice(0, 12);
      moves.innerHTML = recent.length
        ? recent
            .map(
              (item) => `<article class="stay-row">
                <div>
                  <strong>${escapeHtml(item.name)} · ${escapeHtml(item.move)}</strong>
                  <small>${escapeHtml([item.date, item.detail].filter(Boolean).join(" · "))}</small>
                </div>
              </article>`
            )
            .join("")
        : `<p class="stay-hint">Οι κινήσεις γράφονται εδώ: ουρά, μήνυμα, landing, αγορά.</p>`;
    }
  }

  async function loadStayLeads() {
    setStayLeadsStatus("");
    try {
      stayLeads = await stayBoardRequest({ action: "leads" });
      renderStayLeads();
      if (!stayLeads.canWrite) {
        setStayLeadsStatus("Βλέπεις το Google Sheet. Για να γράφεται από εδώ η ουρά, η landing και η αγορά, το Sheet μοιράζεται με τον λογαριασμό του site.");
      }
    } catch (err) {
      setStayLeadsStatus(err?.message || "Οι επαφές δεν φορτώθηκαν.");
    }
  }

  function showStayPanel(name) {
    ["landings", "oldway", "leads", "pipeline", "sequences", "reviews", "settings"].forEach((id) => {
      const panel = document.getElementById(`stay-panel-${id}`);
      if (panel) panel.hidden = id !== name;
    });
    document.querySelectorAll("[data-stay-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stayTab === name);
    });
    if (name === "leads") loadStayLeads();
    if (name === "settings") loadStayUsers();
  }

  const STAY_PERM_LABELS = {
    pipeline: "Pipeline",
    landings: "LandingPages",
    oldway: "The Old Way upload",
    leads: "Επαφές",
    sequences: "Emails",
    reviews: "Κριτικές",
  };

  function applyStayPerms() {
    const role = currentRole();
    const perms = stayPermissions();
    document.querySelectorAll("[data-stay-tab]").forEach((button) => {
      const tab = button.dataset.stayTab;
      const allowed = tab === "settings" ? role === "admin" : role !== "sub" || perms?.[tab] === true;
      button.hidden = !allowed;
    });
    if (role !== "sub") return;
    const open = document.querySelector(".stay-panel:not([hidden])");
    const id = open?.id?.replace("stay-panel-", "") || "";
    if (perms?.[id] === true) return;
    const first = Object.keys(STAY_PERM_LABELS).find((key) => perms?.[key] === true);
    if (first) showStayPanel(first);
  }

  function stayUserStatus(text) {
    const status = document.getElementById("stay-user-status");
    if (status) status.textContent = text || "";
  }

  function renderStayUsers(users) {
    const list = document.getElementById("stay-user-list");
    if (!list) return;
    const rows = Array.isArray(users) ? users : [];
    list.innerHTML = rows.length
      ? rows
          .map((item) => {
            const tags = Object.entries(STAY_PERM_LABELS)
              .filter(([key]) => item.permissions?.[key])
              .map(([, label]) => `<span>${escapeHtml(label)}</span>`)
              .join("");
            return `<article class="stay-user-row">
              <div><strong>${escapeHtml(item.name || item.user)}</strong><small>${escapeHtml(item.user)}</small><div class="stay-user-row__tags">${tags}</div></div>
              <div class="stay-card__tools">
                <button type="button" class="btn btn--ghost btn--sm" data-user-edit="${escapeHtml(item.id)}">Επεξεργασία</button>
                <button type="button" class="btn btn--ghost btn--sm btn--danger" data-user-remove="${escapeHtml(item.id)}" data-user-name="${escapeHtml(item.user)}">Διαγραφή</button>
              </div>
            </article>`;
          })
          .join("")
      : `<p class="stay-hint">Δεν έχεις φτιάξει χρήστη ακόμα.</p>`;
    list.querySelectorAll("[data-user-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = rows.find((row) => row.id === button.getAttribute("data-user-edit"));
        const form = document.getElementById("stay-user-form");
        if (!item || !form) return;
        form.dataset.userId = item.id;
        form.elements.name.value = item.name || "";
        form.elements.user.value = item.user || "";
        form.elements.pass.value = "";
        Object.keys(STAY_PERM_LABELS).forEach((key) => {
          if (form.elements[key]) form.elements[key].checked = item.permissions?.[key] === true;
        });
        stayUserStatus(`Επεξεργασία του ${item.user}. Ο κωδικός μένει ο ίδιος αν τον αφήσεις κενό.`);
      });
    });
  }

  async function loadStayUsers() {
    if (currentRole() !== "admin") return;
    stayUserStatus("");
    try {
      const result = await stayBoardRequest({ action: "users" });
      renderStayUsers(result.users || []);
    } catch (err) {
      stayUserStatus(err?.message || "Οι χρήστες δεν φορτώθηκαν.");
    }
  }

  let googleFlash = "";
  let googleLinkState = {};

  function paintGoogleLink(data) {
    const card = document.getElementById("google-link");
    if (!card || isStayUser()) return;
    card.hidden = false;
    const uploadCard = document.getElementById("reel-upload");
    if (uploadCard) uploadCard.hidden = false;
    const uploadGo = document.getElementById("reel-upload-go");
    const uploadHint = document.getElementById("reel-upload-hint");
    const status = document.getElementById("google-link-status");
    const error = document.getElementById("google-link-error");
    const setup = document.getElementById("google-link-setup");
    const youtubeBtn = document.getElementById("google-link-youtube");
    const driveBtn = document.getElementById("google-link-drive");
    const disconnect = document.getElementById("google-link-disconnect");
    const info = data || {};
    if (googleFlash && googleFlash !== "connected") info.error = googleFlash;
    googleFlash = "";
    googleLinkState = info;
    if (error) {
      error.hidden = !info.error;
      error.textContent = info.error || "";
    }
    if (setup) setup.hidden = info.configured !== false;
    if (youtubeBtn) youtubeBtn.hidden = !info.configured || Boolean(info.youtube);
    if (driveBtn) driveBtn.hidden = !info.configured || Boolean(info.drive);
    if (disconnect) disconnect.hidden = !info.youtube && !info.drive;
    if (uploadGo && uploadGo.dataset.busy !== "1") uploadGo.disabled = !(info.youtube && info.drive);
    if (uploadHint && uploadGo?.dataset.busy !== "1") {
      uploadHint.textContent =
        info.youtube && info.drive
          ? "Διάλεξε το καθαρό βίντεο και τον ήχο. Το σήμα μπαίνει στον υπολογιστή σου. Το καθαρό πάει στο Drive, το αντίγραφο στο YouTube."
          : "Σύνδεσε πρώτα και το YouTube και το Drive.";
    }
    if (!status) return;
    if (info.youtube || info.drive) {
      const who = escapeHtml(info.email || info.account || "myreels.gr@gmail.com");
      const channel = info.channelId
        ? ` Κανάλι: <a href="https://www.youtube.com/channel/${encodeURIComponent(info.channelId)}" target="_blank" rel="noopener">${escapeHtml(info.channelTitle || "YouTube")}</a>.`
        : "";
      const folder = info.folderUrl
        ? ` Φάκελος: <a href="${escapeHtml(info.folderUrl)}" target="_blank" rel="noopener">MyReels στο Drive</a>.`
        : "";
      const missing = [
        info.youtube ? "" : " Λείπει η σύνδεση YouTube.",
        info.drive ? "" : " Λείπει η σύνδεση Drive.",
      ].join("");
      status.innerHTML = `Συνδεδεμένο ως ${who}.${channel}${folder}${missing}`;
      return;
    }
    if (info.configured === false) {
      const missing = Array.isArray(info.missing) && info.missing.length ? info.missing.join(", ") : "";
      status.textContent = missing
        ? `Λείπουν από το Vercel: ${missing}. Ακολούθησε τα βήματα και μετά πάτα Σύνδεση.`
        : "Η σύνδεση δεν έχει ρυθμιστεί ακόμα.";
      return;
    }
    status.textContent = "Πρώτα Σύνδεση YouTube, μετά Σύνδεση Drive, και τις δύο με το myreels.gr@gmail.com. Το Google δεν τα δέχεται στην ίδια άδεια.";
  }

  async function loadGoogleLink() {
    const card = document.getElementById("google-link");
    if (!card || isStayUser()) return;
    try {
      const live = Boolean(googleFlash);
      const response = await fetch("/api/google-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sessionCreds(), action: "status", live }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && data.ok === false && !data.missing) {
        paintGoogleLink({ configured: true, connected: false, error: data.error || "Η σύνδεση δεν ελέγχθηκε." });
        return;
      }
      paintGoogleLink(data);
    } catch (err) {
      paintGoogleLink({ configured: true, connected: false, error: err?.message || "Η σύνδεση δεν ελέγχθηκε." });
    }
  }

  function setupStayTab() {
    const stay = window.MyReelsStay;
    const form = document.getElementById("stay-form");
    const youtubeInput = document.getElementById("stay-youtube");
    const driveInput = document.getElementById("stay-drive");
    const nameInput = document.getElementById("stay-name");
    const priceInput = document.getElementById("stay-price");
    const pack5Input = document.getElementById("stay-pack5");
    const pack10Input = document.getElementById("stay-pack10");
    const pricePreview = document.getElementById("stay-price-preview");
    const pack5Preview = document.getElementById("stay-pack5-preview");
    const pack10Preview = document.getElementById("stay-pack10-preview");
    const statusEl = document.getElementById("stay-title-status");
    const errorEl = document.getElementById("stay-form-error");
    const copyBtn = document.getElementById("stay-copy");
    const list = document.getElementById("stay-list");
    if (!form || !stay) return;

    const fieldsRoot = document.getElementById("stay-copy-fields");
    const copyTabs = document.getElementById("stay-copy-tabs");
    const copyHint = document.getElementById("stay-copy-hint");
    const copyStatus = document.getElementById("stay-copy-status");
    const doneOpens = document.getElementById("stay-copy-done-opens");
    const openCopyBtn = document.getElementById("stay-copy-open");
    let copyPage = "landing";
    const copyHints = {
      landing:
        "Πάτα μέσα σε ένα πεδίο και γράψε. Άδειο πεδίο δεν φαίνεται στη σελίδα. Τα {name}, {net} και {gross} μπαίνουν μόνα τους. Μετά πάτα «Δημιουργία landing».",
      up10: "Σελίδα των 10. Τα {name}, {net}, {gross}, {pack}, {extra} και {extraGross} μπαίνουν μόνα τους. Στα σημεία, μία γραμμή είναι ένα bullet.",
      up5: "Σελίδα των 5, αν πει όχι στα 10. Ίδια σύμβολα: {name}, {net}, {gross}, {pack}, {extra}, {extraGross}.",
      done: "Οι τρεις επιβεβαιώσεις. Το {name} είναι το κατάλυμα. Άδειο πεδίο κρύβει τη γραμμή.",
      samples:
        "Τα 9 δείγματα της σελίδας. «Κράτα ως default» τα βάζει σε όλες. Αν αλλάξεις κάποιο και πατήσεις Δημιουργία landing, αλλάζει μόνο αυτή. Άδειο YouTube μένει κάδρο.",
    };
    if (fieldsRoot && !fieldsRoot.childElementCount && copyTabs) {
      copyTabs.innerHTML = stay.COPY_PAGES.map(
        (page) =>
          `<button type="button" class="stay-copy-tab${page.id === "landing" ? " is-active" : ""}" data-copy-tab="${page.id}">${escapeHtml(page.label)}</button>`
      ).join("");
      fieldsRoot.innerHTML = stay.COPY_PAGES.map((page) => {
        if (page.id === "samples") {
          const title = page.fields.find((field) => field.key === "title");
          const lead = page.fields.find((field) => field.key === "lead");
          const rows = [];
          for (let index = 1; index <= 9; index += 1) {
            rows.push(`
              <div class="stay-sample-row">
                <span>${index}</span>
                <input id="stay-copy-samples-n${index}" maxlength="80" placeholder="Όνομα καταλύματος" />
                <input id="stay-copy-samples-v${index}" maxlength="200" placeholder="YouTube link" />
              </div>
            `);
          }
          return `
            <div class="stay-copy-page" data-copy-page="samples" hidden>
              <label class="field">
                <span>${escapeHtml(title.label)}</span>
                <textarea id="stay-copy-samples-title" rows="2" maxlength="${title.max}"></textarea>
              </label>
              <label class="field">
                <span>${escapeHtml(lead.label)}</span>
                <textarea id="stay-copy-samples-lead" rows="2" maxlength="${lead.max}"></textarea>
              </label>
              <div class="stay-samples">${rows.join("")}</div>
              <p class="stay-hint" id="stay-sample-clash" hidden></p>
            </div>
          `;
        }
        let lastGroup = "";
        const fields = page.fields
          .map((field) => {
            const group =
              field.group && field.group !== lastGroup
                ? `<p class="stay-copy-group">${escapeHtml((lastGroup = field.group))}</p>`
                : "";
            return `
              ${group}
              <label class="field">
                <span>${escapeHtml(field.label)}</span>
                <textarea id="stay-copy-${page.id}-${field.key}" rows="${field.rows}" maxlength="${field.max}"${field.tall ? ' class="is-tall"' : ""}></textarea>
              </label>
            `;
          })
          .join("");
        return `<div class="stay-copy-page" data-copy-page="${page.id}"${page.id === "landing" ? "" : " hidden"}>${fields}</div>`;
      }).join("");
    }
    fillStayCopyForm(loadDefaultCopy());

    const setCopyStatus = (message) => {
      if (copyStatus) copyStatus.textContent = message;
    };

    const showCopyPage = (id) => {
      copyPage = id;
      copyTabs?.querySelectorAll("[data-copy-tab]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.copyTab === id);
      });
      fieldsRoot?.querySelectorAll("[data-copy-page]").forEach((panel) => {
        panel.hidden = panel.dataset.copyPage !== id;
      });
      if (copyHint) copyHint.textContent = copyHints[id] || copyHints.landing;
      if (openCopyBtn) openCopyBtn.hidden = id === "done";
      if (doneOpens) doneOpens.hidden = id !== "done";
    };

    copyTabs?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-copy-tab]");
      if (!button) return;
      showCopyPage(button.dataset.copyTab);
    });

    const openCopyPage = (kind) => {
      const pages = readStayCopyForm();
      const origin = window.location.origin;
      const name = stay.cleanName(nameInput.value) || "Ηλιοπετρόσπιτο";
      const videoId = stay.parseYouTubeId(youtubeInput.value) || "jNQXAC9IVRw";
      const net = stay.parseNet(priceInput?.value) ?? stay.NET;
      const pack5 = stay.parseNet(pack5Input?.value) ?? stay.PACK_5;
      const pack10 = stay.parseNet(pack10Input?.value) ?? stay.PACK_10;
      const packs = { p: net, p5: pack5, p10: pack10, drive: stay.parseDriveId(driveInput?.value), copy: pages };
      let url = stay.buildDraftLandingUrl(origin, name, videoId, net, pages, packs);
      if (kind === "up10") url = stay.buildUpsellUrl(origin, name, videoId, packs);
      if (kind === "up5") url = stay.buildUpsellUrl(origin, name, videoId, { ...packs, step: 5 });
      if (kind === "done10" || kind === "done5" || kind === "done1") {
        url = stay.buildUpsellUrl(origin, name, videoId, { ...packs, preview: kind.replace("done", "") });
      }
      const preview = new URL(url);
      preview.searchParams.set("draft", "1");
      if (document.querySelector('input[name="stay-mobile"]:checked')?.value === "b") preview.searchParams.set("m", "b");
      window.open(preview, "_blank", "noopener");
    };

    openCopyBtn?.addEventListener("click", () => {
      if (copyPage === "up10") openCopyPage("up10");
      else if (copyPage === "up5") openCopyPage("up5");
      else if (copyPage === "samples") openCopyPage("landing");
      else openCopyPage("landing");
    });
    doneOpens?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-done-open]");
      if (!button) return;
      openCopyPage(`done${button.dataset.doneOpen}`);
    });

    document.getElementById("stay-copy-save-default")?.addEventListener("click", () => {
      const copy = readStayCopyForm();
      localStorage.setItem(STAY_COPY_KEY, JSON.stringify(copy));
      stayBoardRequest({ action: "saveCopy", copy: stay.encodeCopy(copy) })
        .then(() => setCopyStatus("Φαίνεται πλέον σε όλες τις σελίδες."))
        .catch(() => setCopyStatus("Κρατήθηκε σε αυτόν τον browser. Οι σελίδες δεν το πήραν."));
    });

    document.getElementById("stay-copy-load-default")?.addEventListener("click", () => {
      fillStayCopyForm(loadDefaultCopy());
      setCopyStatus("Φορτώθηκε το default.");
    });

    document.getElementById("stay-copy-factory")?.addEventListener("click", () => {
      fillStayCopyForm(null);
      setCopyStatus("Φορτώθηκε το εργοστασιακό κείμενο. Πάτα «Κράτα ως default» αν θέλεις να μείνει.");
    });

    const bindPricePreview = (input, preview) => {
      const paint = () => {
        if (!preview) return;
        const net = stay.parseNet(input?.value);
        preview.textContent =
          net == null ? "Βάλε τιμή χωρίς ΦΠΑ." : `Με ΦΠΑ: ${stay.euro(stay.grossOf(net))}`;
      };
      input?.addEventListener("input", paint);
      paint();
    };

    bindPricePreview(priceInput, pricePreview);
    bindPricePreview(pack5Input, pack5Preview);
    bindPricePreview(pack10Input, pack10Preview);
    bindPricePreview(document.getElementById("reel-price"), document.getElementById("reel-price-preview"));
    bindPricePreview(document.getElementById("reel-pack5"), document.getElementById("reel-pack5-preview"));
    bindPricePreview(document.getElementById("reel-pack10"), document.getElementById("reel-pack10-preview"));

    let lookupToken = 0;

    const lookupTitle = async () => {
      const videoId = stay.parseYouTubeId(youtubeInput.value);
      if (!videoId || nameInput.value.trim()) {
        if (statusEl && !nameInput.value.trim() && youtubeInput.value.trim() && !videoId) {
          statusEl.textContent = "Αυτό δεν μοιάζει με YouTube link.";
        }
        return;
      }
      const token = ++lookupToken;
      if (statusEl) statusEl.textContent = "Διαβάζω τον τίτλο από το YouTube…";
      try {
        const response = await fetch(`/api/youtube-title?url=${encodeURIComponent(youtubeInput.value.trim())}`);
        const data = await response.json().catch(() => ({}));
        if (token !== lookupToken || nameInput.value.trim()) return;
        if (data.ok && data.title) {
          nameInput.value = stay.cleanName(data.title);
          if (statusEl) statusEl.textContent = "Ο τίτλος ήρθε από το YouTube. Άλλαξέ τον αν χρειάζεται.";
          return;
        }
      } catch {
        /* unlisted videos and offline admin keep the manual name */
      }
      if (token !== lookupToken) return;
      if (statusEl) {
        statusEl.textContent =
          "Δεν διαβάστηκε τίτλος. Γράψε το όνομα του καταλύματος — στα unlisted το YouTube δεν τον δίνει.";
      }
    };

    let posterPlayer = null;
    let posterVideoId = "";
    let posterReady = false;
    let posterTimer = 0;

    const posterClock = (seconds) => {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      const minutes = Math.floor(total / 60);
      const rest = total % 60;
      return `${minutes}:${String(rest).padStart(2, "0")}`;
    };

    const readStayPoster = () => {
      const n = Number(document.getElementById("stay-poster-range")?.value);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round(Math.min(n, 3600) * 10) / 10;
    };

    const paintPosterClock = (seconds) => {
      const clock = document.getElementById("stay-poster-clock");
      if (clock) clock.textContent = posterClock(seconds);
    };

    let holdPosterFrame = false;

    const showPosterFrame = (player, seconds) => {
      if (!player || typeof player.seekTo !== "function") return;
      holdPosterFrame = true;
      player.mute();
      player.seekTo(Math.max(0, Number(seconds) || 0), true);
      player.playVideo();
    };

    const mountStayPoster = (videoId, at) => {
      const box = document.getElementById("stay-poster");
      const range = document.getElementById("stay-poster-range");
      if (!box || !range) return;
      if (!videoId) {
        box.hidden = true;
        return;
      }
      const startAt = Number(at) > 0 ? Math.round(Number(at) * 10) / 10 : 0;
      box.hidden = false;
      range.value = String(startAt);
      paintPosterClock(startAt);
      if (posterVideoId === videoId && posterPlayer && posterReady) {
        showPosterFrame(posterPlayer, startAt);
        return;
      }
      posterVideoId = videoId;
      posterReady = false;
      const frame = box.querySelector(".stay-poster__frame");
      if (frame) frame.innerHTML = '<div id="stay-poster-player"></div>';
      const start = () => {
        if (!window.YT || !window.YT.Player) return;
        if (posterPlayer && typeof posterPlayer.destroy === "function") {
          try { posterPlayer.destroy(); } catch { /* a fresh host is already in place */ }
        }
        posterPlayer = new window.YT.Player("stay-poster-player", {
          videoId,
          width: "180",
          height: "320",
          playerVars: {
            autoplay: 0,
            mute: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (posterVideoId !== videoId) return;
              posterReady = true;
              const duration = Number(event.target.getDuration()) || 30;
              range.max = String(Math.max(duration, startAt, 1));
              range.value = String(Math.min(startAt, duration));
              paintPosterClock(range.value);
              if (startAt > 0) showPosterFrame(event.target, startAt);
            },
            onStateChange: (event) => {
              if (posterVideoId !== videoId) return;
              const playing = event.data === window.YT.PlayerState.PLAYING;
              const paused = event.data === window.YT.PlayerState.PAUSED;
              if (holdPosterFrame && playing) {
                holdPosterFrame = false;
                event.target.pauseVideo();
                return;
              }
              if (!playing && !paused) return;
              const now = Math.round(event.target.getCurrentTime() * 10) / 10;
              range.value = String(now);
              paintPosterClock(now);
            },
          },
        });
      };
      if (window.YT && window.YT.Player) start();
      else {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof previous === "function") previous();
          start();
        };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const api = document.createElement("script");
          api.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(api);
        }
      }
    };

    const scrubPoster = () => {
      const seconds = readStayPoster();
      paintPosterClock(seconds);
      window.clearTimeout(posterTimer);
      posterTimer = window.setTimeout(() => showPosterFrame(posterPlayer, seconds), 180);
    };

    document.getElementById("stay-poster-range")?.addEventListener("input", scrubPoster);

    const openPoster = (at) => mountStayPoster(stay.parseYouTubeId(youtubeInput.value), at);

    const markSampleClash = () => {
      const hero = stay.parseYouTubeId(youtubeInput.value);
      const same = [];
      for (let index = 1; index <= 9; index += 1) {
        const input = document.getElementById(`stay-copy-samples-v${index}`);
        const row = input?.closest(".stay-sample-row");
        const id = stay.parseYouTubeId(input?.value || "");
        const clash = Boolean(hero && id && hero === id);
        row?.classList.toggle("is-same", clash);
        if (clash) same.push(String(index));
      }
      const note = document.getElementById("stay-sample-clash");
      if (!note) return;
      note.hidden = same.length === 0;
      if (!same.length) {
        note.textContent = "";
        return;
      }
      const one = same.length === 1;
      note.textContent = one
        ? `Το δείγμα ${same[0]} έχει το ίδιο YouTube με το κύριο Reel. Άλλαξέ το σε αυτή τη σελίδα.`
        : `Τα δείγματα ${same.join(", ")} έχουν το ίδιο YouTube με το κύριο Reel. Άλλαξέ τα σε αυτή τη σελίδα.`;
    };

    youtubeInput.addEventListener("input", markSampleClash);
    youtubeInput.addEventListener("change", markSampleClash);
    fieldsRoot?.addEventListener("input", (event) => {
      if (String(event.target?.id || "").startsWith("stay-copy-samples-")) markSampleClash();
    });
    markSampleClash();

    youtubeInput.addEventListener("change", lookupTitle);
    youtubeInput.addEventListener("change", () => openPoster(readStayPoster()));
    youtubeInput.addEventListener("paste", () => {
      setTimeout(() => {
        lookupTitle();
        openPoster(readStayPoster());
      }, 0);
    });

    async function publishStayLanding(input) {
      const target = input.errorTarget;
      const fail = (text) => {
        if (target) {
          target.hidden = false;
          target.textContent = text;
        }
        return null;
      };
      if (target) target.hidden = true;
      const name = stay.cleanName(input.name);
      const videoId = stay.parseYouTubeId(input.youtubeUrl);
      const driveId = stay.parseDriveId(input.driveId || input.driveUrl);
      const net = stay.parseNet(input.net);
      const pack5 = stay.parseNet(input.pack5);
      const pack10 = stay.parseNet(input.pack10);
      if (!videoId) return fail("Βάλε ένα έγκυρο YouTube link (watch, youtu.be ή Shorts).");
      if (!driveId) return fail("Βάλε το link του αρχείου από το Google Drive.");
      if (name.length < 2) return fail("Γράψε το όνομα του καταλύματος.");
      if (net == null) return fail("Βάλε την τιμή του πρώτου βίντεο χωρίς ΦΠΑ. Default είναι 40€.");
      if (pack5 == null || pack10 == null) {
        return fail("Βάλε τις τιμές των πακέτων χωρίς ΦΠΑ. Default είναι 170€ για τα 5 και 350€ για τα 10.");
      }
      const copy = readStayCopyForm();
      const encodedCopy = stay.encodeCopy(copy);
      if (encodedCopy.length > 20000) return fail("Το κείμενο είναι πολύ μεγάλο. Σύντομεψέ το.");
      const previous = loadStays();
      const taken = previous
        .filter((item) => item.videoId !== videoId)
        .map((item) => item.slug || item.name);
      const slug = stay.landingSlug(name, taken);
      const url = stay.buildLandingUrl(window.location.origin, slug);
      const items = previous.filter(
        (item) =>
          !(
            item.videoId === videoId &&
            stay.cleanName(item.name).toLowerCase() === name.toLowerCase() &&
            (stay.parseNet(item.net) ?? stay.NET) === net
          )
      );
      const item = {
        id: `stay-${Date.now()}`,
        name,
        videoId,
        net,
        pack5,
        pack10,
        youtubeUrl: String(input.youtubeUrl || "").trim(),
        posterAt: input.posterAt != null ? input.posterAt : readStayPoster(),
        mobile: input.mobile === "b" ? "b" : "a",
        driveId,
        driveUrl: stay.driveFileUrl(driveId),
        copy,
        samples: sampleOverrides(copy, loadDefaultCopy()),
        slug,
        createdAt: Date.now(),
      };
      items.unshift(item);
      saveStays(items.slice(0, 40));
      showStayResult(item);
      renderStayList();
      stayBoardRequest({
        action: "upsert",
        deal: {
          videoId,
          property: name,
          net,
          pack5,
          pack10,
          slug,
          copy: stay.encodeCopy(copyWithoutSampleOverrides(copy)),
          samples: item.samples,
          landingUrl: url,
          driveUrl: item.driveUrl,
          posterAt: item.posterAt || 0,
          mobile: input.mobile === "b" ? "b" : "a",
          createdAt: new Date(item.createdAt).toISOString(),
        },
      })
        .then((result) => {
          applyStayBoard(result);
          if (result.sheet) setStayBoardStatus(result.sheet);
        })
        .catch((err) => setStayBoardStatus(err?.message || "Η landing δεν μπήκε στο pipeline."));
      const ok = await copyText(url);
      if (copyBtn) {
        copyBtn.textContent = ok ? "Αντιγράφηκε ✓" : "Αντιγραφή link";
        setTimeout(() => {
          copyBtn.textContent = "Αντιγραφή link";
        }, 1600);
      }
      return { ...item, url };
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await publishStayLanding({
        name: nameInput.value,
        youtubeUrl: youtubeInput.value,
        driveId: driveInput?.value,
        net: priceInput?.value,
        pack5: pack5Input?.value,
        pack10: pack10Input?.value,
        mobile: document.querySelector('input[name="stay-mobile"]:checked')?.value,
        errorTarget: errorEl,
      });
    });

    const reelGo = document.getElementById("reel-upload-go");
    const reelStatus = document.getElementById("reel-upload-status");
    const reelError = document.getElementById("reel-upload-error");
    const reelTrack = document.getElementById("reel-upload-track");
    const reelBar = document.getElementById("reel-upload-bar");
    const reelDone = document.getElementById("reel-upload-done");
    const phaseLabel = {
      load: "Κατεβαίνει ο επεξεργαστής…",
      encode: "Μπαίνει το σήμα και ο ήχος…",
      drive: "Ανεβαίνει το καθαρό στο Drive…",
      youtube: "Ανεβαίνει το αντίγραφο στο YouTube…",
    };
    const stayNameFromFile = (file) => stay.cleanName(String(file?.name || "").replace(/\.[^.]+$/, "")).slice(0, 80);
    document.getElementById("reel-file")?.addEventListener("change", () => {
      const picked = document.getElementById("reel-file")?.files?.[0];
      const nameInput = document.getElementById("reel-name");
      if (nameInput) nameInput.value = picked ? stayNameFromFile(picked) : "";
    });
    reelGo?.addEventListener("click", async () => {
      if (!window.MyReelsUpload) {
        if (reelError) {
          reelError.hidden = false;
          reelError.textContent = "Ο επεξεργαστής δεν φόρτωσε ακόμα. Ξαναπάτα σε λίγο.";
        }
        return;
      }
      const file = document.getElementById("reel-file")?.files?.[0];
      const name = stayNameFromFile(file);
      const nameInput = document.getElementById("reel-name");
      if (nameInput) nameInput.value = name;
      if (reelError) reelError.hidden = true;
      if (reelDone) reelDone.hidden = true;
      if (!file) {
        if (reelError) {
          reelError.hidden = false;
          reelError.textContent = "Διάλεξε το καθαρό βίντεο.";
        }
        return;
      }
      if (stay.cleanName(name).length < 2) {
        if (reelError) {
          reelError.hidden = false;
          reelError.textContent = "Το αρχείο χρειάζεται όνομα, π.χ. Ηλιοπετρόσπιτο.mp4.";
        }
        return;
      }
      if (!googleLinkState.youtube || !googleLinkState.drive) {
        if (reelError) {
          reelError.hidden = false;
          reelError.textContent = "Σύνδεσε πρώτα και το YouTube και το Drive.";
        }
        return;
      }
      reelGo.dataset.busy = "1";
      reelGo.disabled = true;
      if (reelTrack) reelTrack.hidden = false;
      try {
        const uploaded = await window.MyReelsUpload.run({
          file,
          markUrl: "/admin/brand/watermark.png?v=3",
          name: stay.cleanName(name),
          creds: sessionCreds(),
          onProgress: ({ phase, ratio }) => {
            const label = phaseLabel[phase] || "Δουλεύει…";
            const percent = Math.round((ratio || 0) * 100);
            if (reelStatus) reelStatus.textContent = percent > 0 && percent < 100 ? `${label} ${percent}%` : label;
            if (reelBar) reelBar.style.width = `${percent}%`;
          },
        });
        if (reelStatus) reelStatus.textContent = "Φτιάχνεται η landing…";
        const item = await publishStayLanding({
          name,
          youtubeUrl: uploaded.youtubeUrl,
          driveId: uploaded.driveId,
          net: document.getElementById("reel-price")?.value,
          pack5: document.getElementById("reel-pack5")?.value,
          pack10: document.getElementById("reel-pack10")?.value,
          posterAt: 0,
          mobile: document.querySelector('input[name="reel-mobile"]:checked')?.value,
          errorTarget: reelError,
        });
        if (!item) {
          if (reelError && !reelError.textContent) {
            reelError.hidden = false;
            reelError.textContent = "Τα αρχεία ανέβηκαν, αλλά η landing δεν φτιάχτηκε.";
          }
          if (reelStatus) {
            reelStatus.textContent = `YouTube: ${uploaded.youtubeUrl} · Drive: ${uploaded.driveUrl}`;
          }
          return;
        }
        const urlEl = document.getElementById("reel-upload-url");
        const openEl = document.getElementById("reel-upload-open");
        if (urlEl) urlEl.value = item.url;
        if (openEl) openEl.href = item.url;
        if (reelDone) reelDone.hidden = false;
        if (reelStatus) reelStatus.textContent = "Η landing είναι έτοιμη. Το YouTube μπορεί να χρειαστεί ένα λεπτό μέχρι να παίξει.";
        const fileInput = document.getElementById("reel-file");
        if (fileInput) fileInput.value = "";
      } catch (err) {
        if (reelError) {
          reelError.hidden = false;
          reelError.textContent = err?.message || "Το ανέβασμα δεν ολοκληρώθηκε.";
        }
        if (reelStatus) {
          reelStatus.textContent = err?.driveUrl
            ? `Το καθαρό είναι στο Drive: ${err.driveUrl}`
            : "";
        }
      } finally {
        delete reelGo.dataset.busy;
        reelGo.disabled = !(googleLinkState.youtube && googleLinkState.drive);
        if (reelTrack) reelTrack.hidden = true;
        if (reelBar) reelBar.style.width = "0";
      }
    });
    document.getElementById("reel-upload-copy")?.addEventListener("click", async () => {
      const button = document.getElementById("reel-upload-copy");
      const ok = await copyText(document.getElementById("reel-upload-url")?.value || "");
      if (button) {
        button.textContent = ok ? "Αντιγράφηκε ✓" : "Αποτυχία";
        setTimeout(() => {
          button.textContent = "Αντιγραφή link";
        }, 1600);
      }
    });

    copyBtn?.addEventListener("click", async () => {
      const urlEl = document.getElementById("stay-result-url");
      const ok = await copyText(urlEl?.value || "");
      copyBtn.textContent = ok ? "Αντιγράφηκε ✓" : "Αποτυχία";
      setTimeout(() => {
        copyBtn.textContent = "Αντιγραφή link";
      }, 1600);
    });

    list?.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-stay-edit]");
      const copy = event.target.closest("[data-stay-copy]");
      const remove = event.target.closest("[data-stay-delete]");
      if (edit) {
        const item = loadStays().find((row) => row.id === edit.getAttribute("data-stay-edit"));
        if (!item) return;
        youtubeInput.value = item.youtubeUrl || `https://youtu.be/${item.videoId}`;
        if (driveInput) driveInput.value = item.driveUrl || stay.driveFileUrl(item.driveId);
        nameInput.value = item.name;
        if (priceInput) priceInput.value = String(stay.parseNet(item.net) ?? stay.NET);
        if (pack5Input) pack5Input.value = String(stay.parseNet(item.pack5) ?? stay.PACK_5);
        if (pack10Input) pack10Input.value = String(stay.parseNet(item.pack10) ?? stay.PACK_10);
        priceInput?.dispatchEvent(new Event("input"));
        pack5Input?.dispatchEvent(new Event("input"));
        pack10Input?.dispatchEvent(new Event("input"));
        const pages = stay.normalizePages(item.copy || null);
        pages.samples = samplesForItem(item);
        fillStayCopyForm(pages);
        markSampleClash();
        const savedPoster = Number(item.posterAt) || (stayBoard.deals || []).find((deal) => deal.videoId === item.videoId)?.posterAt || 0;
        openPoster(savedPoster);
        const savedMobile = item.mobile === "b" || (stayBoard.deals || []).find((deal) => deal.videoId === item.videoId)?.mobile === "b" ? "b" : "a";
        document.querySelectorAll('input[name="stay-mobile"]').forEach((input) => {
          input.checked = input.value === savedMobile;
        });
        showCopyPage("landing");
        showStayPanel("oldway");
        setCopyStatus("Φορτώθηκε αυτή η landing. Άλλαξε το κείμενο και πάτα Δημιουργία.");
        const copyCard = document.getElementById("stay-copy-card");
        copyCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("stay-copy-landing-headline")?.focus();
      }
      if (copy) {
        const ok = await copyText(copy.getAttribute("data-stay-copy") || "");
        const previous = copy.textContent;
        copy.textContent = ok ? "Αντιγράφηκε ✓" : "Αποτυχία";
        setTimeout(() => {
          copy.textContent = previous;
        }, 1400);
      }
      if (remove) {
        const id = remove.getAttribute("data-stay-delete");
        const removed = loadStays().find((item) => item.id === id);
        saveStays(loadStays().filter((item) => item.id !== id));
        renderStayList();
        if (removed?.videoId) {
          stayBoardRequest({ action: "remove", videoId: removed.videoId })
            .then(applyStayBoard)
            .catch(() => {});
        }
      }
    });

    document.querySelectorAll("[data-stay-tab]").forEach((button) => {
      button.addEventListener("click", () => showStayPanel(button.dataset.stayTab));
    });
    applyStayPerms();
    document.getElementById("stay-user-clear")?.addEventListener("click", () => {
      const form = document.getElementById("stay-user-form");
      if (!form) return;
      delete form.dataset.userId;
      form.reset();
      if (form.elements.pipeline) form.elements.pipeline.checked = true;
      stayUserStatus("");
    });
    document.getElementById("stay-user-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (currentRole() !== "admin") return;
      const form = event.currentTarget;
      const button = document.getElementById("stay-user-save");
      if (button) button.disabled = true;
      const fields = new FormData(form);
      const permissions = {};
      Object.keys(STAY_PERM_LABELS).forEach((key) => {
        permissions[key] = Boolean(form.elements[key]?.checked);
      });
      try {
        const result = await stayBoardRequest({
          action: "saveUser",
          id: form.dataset.userId || "",
          name: fields.get("name") || "",
          account: fields.get("user") || "",
          password: fields.get("pass") || "",
          permissions,
        });
        delete form.dataset.userId;
        form.reset();
        if (form.elements.pipeline) form.elements.pipeline.checked = true;
        renderStayUsers(result.users || []);
        stayUserStatus("Ο χρήστης αποθηκεύτηκε. Μπαίνει με αυτό το username και τον κωδικό.");
      } catch (err) {
        stayUserStatus(err?.message || "Ο χρήστης δεν αποθηκεύτηκε.");
      }
      if (button) button.disabled = false;
    });
    document.getElementById("stay-user-list")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-user-remove]");
      if (!button) return;
      const name = button.getAttribute("data-user-name") || "τον χρήστη";
      if (!window.confirm(`Να διαγραφεί ο χρήστης ${name};`)) return;
      button.disabled = true;
      try {
        const result = await stayBoardRequest({ action: "removeUser", id: button.getAttribute("data-user-remove") || "" });
        renderStayUsers(result.users || []);
        stayUserStatus("Ο χρήστης διαγράφηκε.");
      } catch (err) {
        stayUserStatus(err?.message || "Ο χρήστης δεν διαγράφηκε.");
        button.disabled = false;
      }
    });
    document.getElementById("stay-find")?.addEventListener("input", (event) => {
      stayQuery = event.target.value || "";
      renderStayPipeline();
    });
    document.getElementById("stay-stages")?.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-stay-focus]");
      if (!chip) return;
      stayFocus = chip.getAttribute("data-stay-focus") || "landing";
      renderStayPipeline();
    });

    document.getElementById("stay-lead-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("stay-lead-save");
      if (button) button.disabled = true;
      try {
        stayLeads = await stayBoardRequest({
          action: "leadSave",
          lead: {
            name: document.getElementById("stay-lead-name")?.value || "",
            region: document.getElementById("stay-lead-region")?.value || "",
            link: document.getElementById("stay-lead-link")?.value || "",
            email: document.getElementById("stay-lead-email")?.value || "",
            phone: document.getElementById("stay-lead-phone")?.value || "",
            social: document.getElementById("stay-lead-social")?.value || "",
            channel: document.getElementById("stay-lead-channel")?.value || "",
            notes: document.getElementById("stay-lead-notes")?.value || "",
          },
        });
        renderStayLeads();
        event.target.reset();
        const channel = document.getElementById("stay-lead-channel");
        if (channel) channel.value = "Instagram";
        setStayLeadsStatus("Μπήκε στην ουρά.");
      } catch (err) {
        setStayLeadsStatus(err?.message || "Η επαφή δεν μπήκε στην ουρά.");
      }
      if (button) button.disabled = false;
    });

    document.getElementById("stay-lead-queue")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-lead-sent]");
      if (!button) return;
      button.disabled = true;
      try {
        stayLeads = await stayBoardRequest({
          action: "leadMove",
          property: button.getAttribute("data-lead-sent") || "",
          move: "Στάλθηκε μήνυμα",
        });
        renderStayLeads();
        setStayLeadsStatus("Γράφτηκε ότι στάλθηκε το μήνυμα.");
      } catch (err) {
        setStayLeadsStatus(err?.message || "Η κίνηση δεν γράφτηκε.");
        button.disabled = false;
      }
    });
  }

    function forgetStayVideos(videoIds) {
      const ids = new Set(videoIds.filter(Boolean));
      if (!ids.size) return;
      saveStays(loadStays().filter((item) => !ids.has(item.videoId)));
      renderStayList();
    }

    async function runArchive(videoIds, archived) {
      const ids = videoIds.filter(Boolean);
      if (!ids.length) return;
      const ask = archived
        ? ids.length === 1
          ? `Να αρχειοθετηθεί το «${stayDealName(ids[0])}»; Φεύγει από τις στήλες. Η σελίδα μένει ανοιχτή.`
          : `Να αρχειοθετηθούν ${ids.length}; Φεύγουν από τις στήλες. Οι σελίδες μένουν ανοιχτές.`
        : ids.length === 1
          ? `Να γυρίσει το «${stayDealName(ids[0])}» στην πορεία;`
          : `Να γυρίσουν ${ids.length} στην πορεία;`;
      if (!window.confirm(ask)) return;
      const result = await stayBoardRequest({ action: "archive", videoIds: ids, archived });
      ids.forEach((id) => stayPick.delete(id));
      applyStayBoard(result);
      setStayBoardStatus(archived ? "Μπήκαν στο αρχείο." : "Γύρισαν στην πορεία.");
    }

    async function runRemove(videoIds) {
      const ids = videoIds.filter(Boolean);
      if (!ids.length) return;
      const ask = ids.length === 1
        ? `Να διαγραφεί το «${stayDealName(ids[0])}» από την πορεία; Η σελίδα σταματάει να ανοίγει.`
        : `Να διαγραφούν ${ids.length} από την πορεία; Οι σελίδες σταματούν να ανοίγουν.`;
      if (!window.confirm(ask)) return;
      const result = await stayBoardRequest({ action: "removeDeals", videoIds: ids });
      forgetStayVideos(ids);
      ids.forEach((id) => stayPick.delete(id));
      applyStayBoard(result);
      setStayBoardStatus(ids.length === 1 ? "Διαγράφηκε από την πορεία." : `Διαγράφηκαν ${ids.length}.`);
    }

    function onPipelineClick(event) {
      const archive = event.target.closest("[data-stay-archive]");
      const restore = event.target.closest("[data-stay-restore]");
      const remove = event.target.closest("[data-stay-remove]");
      if (archive) {
        runArchive([archive.getAttribute("data-stay-archive") || ""], true).catch((err) => {
          setStayBoardStatus(err?.message || "Δεν αρχειοθετήθηκε.");
        });
        return true;
      }
      if (restore) {
        runArchive([restore.getAttribute("data-stay-restore") || ""], false).catch((err) => {
          setStayBoardStatus(err?.message || "Δεν γύρισε στην πορεία.");
        });
        return true;
      }
      if (remove) {
        runRemove([remove.getAttribute("data-stay-remove") || ""]).catch((err) => {
          setStayBoardStatus(err?.message || "Δεν διαγράφηκε.");
        });
        return true;
      }
      return false;
    }

    function onPipelinePick(event) {
      const box = event.target.closest("[data-stay-pick]");
      if (!box) return;
      const id = box.getAttribute("data-stay-pick") || "";
      if (box.checked) stayPick.add(id);
      else stayPick.delete(id);
      paintPick();
    }

    document.getElementById("stay-panel-pipeline")?.addEventListener("click", async (event) => {
      if (event.target.id === "stay-sheet" || event.target.closest("[data-stay-close]")) {
        stayOpen = "";
        const sheet = document.getElementById("stay-sheet");
        if (sheet) sheet.hidden = true;
        return;
      }
      const opener = event.target.closest("[data-stay-open]");
      if (opener) {
        stayOpen = opener.getAttribute("data-stay-open") || "";
        paintStaySheet();
        return;
      }
      if (onPipelineClick(event)) return;
      const move = event.target.closest("[data-stay-move]");
      if (move) {
        const stage = move.getAttribute("data-stay-move") || "";
        const labels = { bought: "Αγόρασε το Reel", pack5: "Πακέτο 5", pack10: "Πακέτο 10", out: "Δεν ενδιαφέρεται" };
        const label = labels[stage];
        const property = move.getAttribute("data-stay-property") || "το κατάλυμα";
        const videoId = move.getAttribute("data-stay-video") || "";
        if (!label || !videoId) return;
        if (!window.confirm(`Να περάσει το «${property}» στο «${label}»;`)) return;
        move.disabled = true;
        try {
          const result = await stayBoardRequest({ action: "move", videoId, stage });
          applyStayBoard(result);
          if (result.sheet) {
            setStayBoardStatus(result.sheet);
            move.disabled = false;
            return;
          }
          if (stage === "out") {
            setStayBoardStatus(`Πέρασε στο «${label}».`);
            return;
          }
          const deal = (result.deals || []).find((item) => item.videoId === videoId);
          const sent = deal && Object.keys(deal.sent || {}).length > 0;
          setStayBoardStatus(
            sent
              ? `Πέρασε στο «${label}». Έφυγε το email της παραγγελίας.`
              : deal?.email
                ? `Πέρασε στο «${label}».`
                : `Πέρασε στο «${label}». Δεν υπάρχει email, οπότε δεν έφυγε μήνυμα.`
          );
        } catch (err) {
          setStayBoardStatus(err?.message || "Δεν μετακινήθηκε.");
          move.disabled = false;
        }
        return;
      }
      const button = event.target.closest("[data-viber-phone]");
      if (!button) return;
      button.disabled = true;
      try {
        let token = button.getAttribute("data-viber-token") || "";
        if (!/^[a-f0-9]{24}$/.test(token)) {
          const linked = await stayBoardRequest({
            action: "reviewLink",
            videoId: button.getAttribute("data-viber-video") || "",
            property: button.getAttribute("data-viber-property") || "",
          });
          token = linked.token || "";
          applyStayBoard(linked);
        }
        const name = button.getAttribute("data-viber-name") || "";
        const property = button.getAttribute("data-viber-property") || "το κατάλυμα";
        const hello = name ? `Γεια σου ${name}` : "Γεια σου";
        const text = `${hello},\n\nΑν δεν μας έγραψες ακόμα δύο λόγια για την εμπειρία σου, θα μας βοηθούσε αφάνταστα αν αφιέρωνες μόλις 30 δευτερόλεπτα για να μας αφήσεις μια σύντομη αξιολόγηση.\n${location.origin}/review?t=${token}`;
        await navigator.clipboard.writeText(text);
        const videoId = button.getAttribute("data-viber-video") || "";
        if (videoId) {
          try {
            const marked = await stayBoardRequest({ action: "viber", videoId });
            applyStayBoard(marked);
          } catch (markErr) {
            setStayBoardStatus(markErr?.message || "Το μήνυμα αντιγράφηκε, αλλά δεν καταγράφηκε.");
          }
        }
        const opener = document.createElement("a");
        opener.href = `viber://chat?number=+${button.getAttribute("data-viber-phone")}`;
        document.body.appendChild(opener);
        opener.click();
        opener.remove();
        setStayBoardStatus("Το μήνυμα αντιγράφηκε. Άνοιξε το Viber και κάνε επικόλληση.");
      } catch (err) {
        setStayBoardStatus(err?.message || "Το Viber δεν άνοιξε.");
      }
      button.disabled = false;
    });

    document.getElementById("stay-board")?.addEventListener("change", onPipelinePick);
    document.getElementById("stay-archive")?.addEventListener("change", onPipelinePick);
    document.getElementById("stay-pick-all")?.addEventListener("change", (event) => {
      const on = event.target.checked;
      document.querySelectorAll("#stay-board [data-stay-pick], #stay-archive [data-stay-pick]").forEach((box) => {
        const id = box.getAttribute("data-stay-pick") || "";
        box.checked = on;
        if (on) stayPick.add(id);
        else stayPick.delete(id);
      });
      paintPick();
    });
    document.getElementById("stay-bulk-archive")?.addEventListener("click", () => {
      runArchive([...stayPick], true).catch((err) => setStayBoardStatus(err?.message || "Δεν αρχειοθετήθηκε."));
    });
    document.getElementById("stay-delete-picked")?.addEventListener("click", () => {
      runRemove([...stayPick]).catch((err) => setStayBoardStatus(err?.message || "Δεν διαγράφηκε."));
    });
    document.getElementById("stay-archive-toggle")?.addEventListener("click", () => {
      document.getElementById("stay-archive")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    async function savePipelineNote(event) {
      const field = event.target.closest("[data-stay-note]");
      if (!field) return;
      const videoId = field.getAttribute("data-stay-note") || "";
      const deal = (stayBoard.deals || []).find((item) => item.videoId === videoId);
      const next = field.value.trim();
      if (!deal || (deal.note || "") === next) return;
      const previous = deal.note || "";
      deal.note = next;
      try {
        const result = await stayBoardRequest({ action: "note", videoId, note: next });
        const saved = (result.deals || []).find((item) => item.videoId === videoId);
        deal.note = saved?.note || next;
        setStayBoardStatus("Η σημείωση κρατήθηκε.");
      } catch (err) {
        deal.note = previous;
        field.value = previous;
        setStayBoardStatus(err?.message || "Η σημείωση δεν κρατήθηκε.");
      }
    }
    document.getElementById("stay-board")?.addEventListener("focusout", savePipelineNote);
    document.getElementById("stay-archive")?.addEventListener("focusout", savePipelineNote);
    document.getElementById("stay-sheet")?.addEventListener("focusout", savePipelineNote);
    document.getElementById("stay-sheet")?.addEventListener("change", (event) => {
      if (event.target?.name !== "document") return;
      const box = event.target.closest("form")?.querySelector(".stay-edit__invoice");
      if (box) box.hidden = event.target.value !== "invoice";
    });
    document.getElementById("stay-sheet")?.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-stay-edit]");
      if (!form) return;
      event.preventDefault();
      const videoId = form.getAttribute("data-stay-edit") || "";
      const data = Object.fromEntries(new FormData(form).entries());
      const button = form.querySelector("[type=submit]");
      if (button) button.disabled = true;
      try {
        const result = await stayBoardRequest({ action: "edit", videoId, ...data });
        applyStayBoard(result);
        setStayBoardStatus("Αποθηκεύτηκε.");
      } catch (err) {
        setStayBoardStatus(err?.message || "Δεν αποθηκεύτηκε.");
        if (button) button.disabled = false;
      }
    });

    document.getElementById("stay-reviews")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-review-id]");
      if (!button) return;
      button.disabled = true;
      try {
        const result = await stayBoardRequest({
          action: "moderate",
          id: button.getAttribute("data-review-id"),
          status: button.getAttribute("data-review-status"),
        });
        applyStayBoard(result);
        setStayBoardStatus(button.getAttribute("data-review-status") === "approved" ? "Μπήκε πάνω από τα δείγματα." : "Έφυγε από την ιστοσελίδα.");
      } catch (err) {
        setStayBoardStatus(err?.message || "Η κριτική δεν άλλαξε.");
        button.disabled = false;
      }
    });

  async function startGoogleLink(service, button) {
    if (button) button.disabled = true;
    try {
      const response = await fetch("/api/google-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sessionCreds(), action: "start", service }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Η σύνδεση δεν ξεκίνησε.");
      location.href = data.url;
    } catch (err) {
      paintGoogleLink({ configured: true, youtube: false, drive: false, error: err?.message || "Η σύνδεση δεν ξεκίνησε." });
      if (button) button.disabled = false;
    }
  }

  document.getElementById("google-link-youtube")?.addEventListener("click", () => {
    startGoogleLink("youtube", document.getElementById("google-link-youtube"));
  });
  document.getElementById("google-link-drive")?.addEventListener("click", () => {
    startGoogleLink("drive", document.getElementById("google-link-drive"));
  });

  document.getElementById("google-link-disconnect")?.addEventListener("click", async () => {
    if (!window.confirm("Να κοπεί η σύνδεση με το YouTube και το Drive;")) return;
    const button = document.getElementById("google-link-disconnect");
    if (button) button.disabled = true;
    try {
      const response = await fetch("/api/google-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sessionCreds(), action: "disconnect" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || "Η αποσύνδεση δεν ολοκληρώθηκε.");
      paintGoogleLink(data);
    } catch (err) {
      paintGoogleLink({ configured: true, connected: true, error: err?.message || "Η αποσύνδεση δεν ολοκληρώθηκε." });
    }
    if (button) button.disabled = false;
  });

  // Init
  fillStageSelect("lead");
  fillServiceChecks([]);
  load();
  renderBoard();
  setupOnboardingTab();
  setupStayTab();
  const googleParams = new URLSearchParams(location.search);
  const googleBack = googleParams.get("google");
  if (googleBack === "connected" || googleBack === "youtube" || googleBack === "drive") googleFlash = "connected";
  if (googleParams.get("google") === "error") {
    googleFlash = googleParams.get("reason") || "Η σύνδεση δεν ολοκληρώθηκε.";
  }
  const syncStayApp = () => {
    const narrow = window.matchMedia("(max-width: 768px)").matches;
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      new URLSearchParams(location.search).get("app") === "stay";
    document.body.classList.toggle("is-stay-app", narrow || installed);
    document.body.classList.toggle("is-stay-narrow", narrow);
  };
  syncStayApp();
  window.matchMedia("(max-width: 768px)").addEventListener("change", () => {
    syncStayApp();
    renderStayPipeline();
  });
  if (googleParams.get("google")) {
    history.replaceState({}, "", location.pathname);
    switchTab("stays");
  } else if (document.body.classList.contains("is-stay-app")) {
    switchTab("stays");
    showStayPanel("pipeline");
  }
  }
})();
