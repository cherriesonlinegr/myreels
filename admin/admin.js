(() => {
  const STORAGE_KEY = "myreels_leads";
  const SEQ_KEY = "myreels_sequences";
  const AUTH_KEY = "myreels_admin_auth";
  const ROLE_KEY = "myreels_admin_role";
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
    if (role === "admin" || role === "stay") return role;
    return sessionStorage.getItem(AUTH_KEY) === "1" ? "admin" : "";
  };
  const isStayUser = () => currentRole() === "stay";
  const isAuthed = () => Boolean(currentRole());
  const sessionCreds = () =>
    isStayUser() ? { user: STAY_USER, pass: STAY_PASS } : { user: AUTH_USER, pass: AUTH_PASS };

  const applyRole = () => {
    const stay = isStayUser();
    document.body.classList.toggle("is-viewer", stay);
    const meta = document.querySelector(".sidebar__meta");
    if (meta) meta.textContent = stay ? "Nakis" : "Admin";
    const note = document.getElementById("viewer-note");
    if (note) note.hidden = !stay;
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
    document.body.classList.remove("is-viewer");
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

    // Auto-login if cookies match the expected credentials.
    const remembered = roleOf(savedUser, savedPass);
    if (remembered) {
      sessionStorage.setItem(AUTH_KEY, "1");
      sessionStorage.setItem(ROLE_KEY, remembered);
    }
  })();

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = String(loginUserInput?.value || "").trim();
      const pass = String(loginPassInput?.value || "");
      const role = roleOf(user, pass);
      if (role) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(ROLE_KEY, role);
        if (window.__myreelsAdminReady) {
          location.reload();
          return;
        }
        applyRole();
        if (loginError) loginError.hidden = true;
        showAdmin();
        initAdmin();

        const remember = loginRememberInput ? loginRememberInput.checked : true;
        if (remember) {
          setCookie(COOKIE_USER, user, COOKIE_DAYS);
          setCookie(COOKIE_PASS, pass, COOKIE_DAYS);
        } else {
          deleteCookie(COOKIE_USER);
          deleteCookie(COOKIE_PASS);
        }
        return;
      }
      if (loginError) loginError.hidden = false;
    });
  }

  btnLogout?.addEventListener("click", logout);

  if (!isAuthed()) {
    showLogin();
    return;
  }

  applyRole();
  showAdmin();
  initAdmin();

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

  function stayLandingUrl(item) {
    const stay = window.MyReelsStay;
    const net = stay.parseNet(item.net) ?? stay.NET;
    return stay.buildLandingUrl(
      window.location.origin,
      item.name,
      item.videoId,
      net,
      item.copy,
      { ...stayPacks(item), drive: item.driveId }
    );
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
    const items = loadStays();
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
              <small>${escapeHtml(when)} · 1: ${escapeHtml(grossLabel)} · 5: ${escapeHtml(gross5)} · 10: ${escapeHtml(gross10)}</small>
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
              <button type="button" class="btn btn--ghost btn--sm" data-stay-edit="${escapeHtml(item.id)}">Επεξεργασία</button>
              <button type="button" class="btn btn--ghost btn--sm" data-stay-copy="${escapeHtml(url)}">Αντιγραφή</button>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(url)}" target="_blank" rel="noopener">Άνοιγμα</a>
              <button type="button" class="btn btn--ghost btn--sm" data-stay-delete="${escapeHtml(item.id)}">Διαγραφή</button>
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
    { id: "bought", label: "Αγόρασε το Reel", hint: "Μπαίνουν ονοματεπώνυμο, email και τηλέφωνο" },
    { id: "pack5", label: "Πακέτο 5", hint: "5 Reels συνολικά, χωρίς scheduling" },
    { id: "pack10", label: "Πακέτο 10", hint: "10 Reels και διαχείριση social για 2 μήνες" },
  ];
  let stayBoard = { deals: [], sequences: {} };
  let staySeqStage = "landing";

  function setStayBoardStatus(message) {
    const status = document.getElementById("stay-board-status");
    if (status) status.textContent = message || "";
    const seq = document.getElementById("stay-seq-status");
    if (seq && message) seq.textContent = message;
  }

  async function stayBoardRequest(payload) {
    const response = await fetch("/api/stay-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sessionCreds(), ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Το pipeline δεν φορτώθηκε.");
    }
    return data;
  }

  function applyStayBoard(data) {
    stayBoard = { deals: data.deals || [], sequences: data.sequences || {} };
    renderStayPipeline();
    renderStaySequences();
  }

  async function loadStayBoard() {
    setStayBoardStatus("");
    try {
      await stayBoardRequest({ action: "load" });
      const stay = window.MyReelsStay;
      const deals = loadStays()
        .filter((item) => item.videoId)
        .map((item) => ({
          videoId: item.videoId,
          property: item.name,
          net: stay?.parseNet(item.net) ?? stay?.NET,
          pack5: stay?.parseNet(item.pack5) ?? stay?.PACK_5,
          pack10: stay?.parseNet(item.pack10) ?? stay?.PACK_10,
          landingUrl: stayLandingUrl(item),
          driveUrl: item.driveUrl || stay?.driveFileUrl(item.driveId),
          createdAt: new Date(item.createdAt).toISOString(),
        }));
      const seeded = await stayBoardRequest({ action: "seed", deals });
      applyStayBoard(seeded);
    } catch (err) {
      setStayBoardStatus(err?.message || "Το pipeline δεν φορτώθηκε.");
    }
  }

  function renderStayPipeline() {
    const board = document.getElementById("stay-board");
    if (!board) return;
    board.innerHTML = STAY_STAGE_META.map((stage) => {
      const cards = (stayBoard.deals || []).filter((deal) => deal.stage === stage.id);
      const body = cards.length
        ? cards
            .map(
              (deal) => `
                <article class="stay-card">
                  <strong>${escapeHtml(deal.property || "Χωρίς όνομα")}</strong>
                  <small>${escapeHtml(deal.buyerName || "Χωρίς ονοματεπώνυμο")}</small>
                  <small>${escapeHtml(deal.email || "Χωρίς email")}</small>
                  <small>${escapeHtml(deal.phone || "Χωρίς τηλέφωνο")}</small>
                  ${deal.stage === "bought" && deal.skipped ? `<span class="stay-tag">Skip και στις 2</span>` : ""}
                </article>`
            )
            .join("")
        : `<p class="stay-hint">Κανένα ακόμα</p>`;
      return `<section class="stay-col"><h2>${escapeHtml(stage.label)}</h2><p class="stay-hint">${escapeHtml(stage.hint)}</p>${body}</section>`;
    }).join("");
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
        <button type="button" class="btn" id="stay-seq-add">+ Email</button>
        <button type="button" class="btn" id="stay-seq-save">Αποθήκευση</button>
        <button type="button" class="btn btn--ghost" id="stay-seq-reset">Επαναφορά</button>
        <label class="field stay-seq__to">
          <span>Δοκιμή στο</span>
          <input type="email" id="stay-seq-test-email" placeholder="το email σου" autocomplete="email" value="${escapeHtml(sessionStorage.getItem("myreels_seq_test_to") || "")}" />
        </label>
      </div>
      <p class="stay-hint" id="stay-seq-status">Ημέρα 0 φεύγει μόνη της μόλις το κατάλυμα μπει στο στάδιο και έχουμε email. Οι επόμενες μέρες φεύγουν μόνες τους.</p>
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
          </tbody>
        </table>
      </div>
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
                <button type="button" class="btn btn--ghost" data-seq-delete>Διαγραφή</button>
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
          const result = await stayBoardRequest({ action: "test", to, subject, body: text });
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

  function showStayPanel(name) {
    ["landings", "pipeline", "sequences"].forEach((id) => {
      const panel = document.getElementById(`stay-panel-${id}`);
      if (panel) panel.hidden = id !== name;
    });
    document.querySelectorAll("[data-stay-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stayTab === name);
    });
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
        "Τα ίδια 9 δείγματα μπαίνουν στο κάτω μέρος κάθε σελίδας, με άλλη σειρά. Άδειο YouTube μένει κάδρο μέχρι να βάλεις link.",
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
      let url = stay.buildLandingUrl(origin, name, videoId, net, pages, packs);
      if (kind === "up10") url = stay.buildUpsellUrl(origin, name, videoId, packs);
      if (kind === "up5") url = stay.buildUpsellUrl(origin, name, videoId, { ...packs, step: 5 });
      if (kind === "done10" || kind === "done5" || kind === "done1") {
        url = stay.buildUpsellUrl(origin, name, videoId, { ...packs, preview: kind.replace("done", "") });
      }
      window.open(url, "_blank", "noopener");
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
      setCopyStatus("Αυτό είναι πλέον το default για όλες τις σελίδες. Οι επόμενες landings το κουβαλούν στο link.");
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

    youtubeInput.addEventListener("change", lookupTitle);
    youtubeInput.addEventListener("paste", () => {
      setTimeout(lookupTitle, 0);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (errorEl) errorEl.hidden = true;
      const name = stay.cleanName(nameInput.value);
      const videoId = stay.parseYouTubeId(youtubeInput.value);
      const driveId = stay.parseDriveId(driveInput?.value);
      const net = stay.parseNet(priceInput?.value);
      const pack5 = stay.parseNet(pack5Input?.value);
      const pack10 = stay.parseNet(pack10Input?.value);
      if (!videoId) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Βάλε ένα έγκυρο YouTube link (watch, youtu.be ή Shorts).";
        }
        return;
      }
      if (!driveId) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Βάλε το link του αρχείου από το Google Drive.";
        }
        return;
      }
      if (name.length < 2) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Γράψε το όνομα του καταλύματος.";
        }
        return;
      }

      if (net == null) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Βάλε την τιμή του πρώτου βίντεο χωρίς ΦΠΑ. Default είναι 40€.";
        }
        return;
      }

      if (pack5 == null || pack10 == null) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent =
            "Βάλε τις τιμές των πακέτων χωρίς ΦΠΑ. Default είναι 170€ για τα 5 και 350€ για τα 10.";
        }
        return;
      }

      const copy = readStayCopyForm();
      const url = stay.buildLandingUrl(window.location.origin, name, videoId, net, copy, {
        p5: pack5,
        p10: pack10,
        drive: driveId,
      });
      if (url.length > 7500) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Το κείμενο είναι πολύ μεγάλο για link. Σύντομεψέ το.";
        }
        return;
      }

      const items = loadStays().filter(
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
        youtubeUrl: youtubeInput.value.trim(),
        driveId,
        driveUrl: stay.driveFileUrl(driveId),
        copy,
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
          landingUrl: url,
          driveUrl: item.driveUrl,
          createdAt: new Date(item.createdAt).toISOString(),
        },
      })
        .then(applyStayBoard)
        .catch((err) => setStayBoardStatus(err?.message || "Η landing δεν μπήκε στο pipeline."));
      const ok = await copyText(url);
      if (copyBtn) {
        copyBtn.textContent = ok ? "Αντιγράφηκε ✓" : "Αντιγραφή link";
        setTimeout(() => {
          copyBtn.textContent = "Αντιγραφή link";
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
        fillStayCopyForm(item.copy || null);
        showCopyPage("landing");
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
  }

  // Init
  fillStageSelect("lead");
  fillServiceChecks([]);
  load();
  renderBoard();
  setupOnboardingTab();
  setupStayTab();
  }
})();
