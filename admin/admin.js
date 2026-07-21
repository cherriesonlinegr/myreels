(() => {
  const STORAGE_KEY = "myreels_leads";
  const SEQ_KEY = "myreels_sequences";
  const AUTH_KEY = "myreels_admin_auth";
  const AUTH_USER = "Thereelproject";
  const AUTH_PASS = "reels4YOU";

  const loginGate = document.getElementById("login-gate");
  const adminApp = document.getElementById("admin-app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const btnLogout = document.getElementById("btn-logout");

  const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === "1";

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
    showLogin();
  };

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = String(document.getElementById("login-user")?.value || "").trim();
      const pass = String(document.getElementById("login-pass")?.value || "");
      if (user === AUTH_USER && pass === AUTH_PASS) {
        sessionStorage.setItem(AUTH_KEY, "1");
        if (loginError) loginError.hidden = true;
        showAdmin();
        initAdmin();
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
  }

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
      <article class="card" draggable="true" data-id="${lead.id}" tabindex="0">
        <div class="card__name">${escapeHtml(lead.name)}</div>
        <div class="card__business">${escapeHtml(lead.business)}</div>
        ${svcs ? `<div class="card__chips">${svcs}</div>` : ""}
        <div class="card__meta">
          ${money ? `<span class="card__value">${money}</span>` : ""}
          <span class="card__date">${formatDate(lead.updatedAt || lead.createdAt)}</span>
        </div>
        ${contact ? `<div class="card__contact">${escapeHtml(contact)}</div>` : ""}
        ${
          lead.stage === "accepted" || lead.stage === "payment"
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

  function openNew() {
    modalTitle.textContent = "Νέο Lead";
    form.reset();
    document.getElementById("lead-id").value = "";
    fillStageSelect("lead");
    fillServiceChecks([]);
    btnDelete.hidden = true;
    modal.showModal();
    document.getElementById("lead-name").focus();
  }

  function openEdit(id) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    modalTitle.textContent = "Επεξεργασία Lead";
    document.getElementById("lead-id").value = lead.id;
    document.getElementById("lead-name").value = lead.name || "";
    document.getElementById("lead-business").value = lead.business || "";
    document.getElementById("lead-email").value = lead.email || "";
    document.getElementById("lead-phone").value = lead.phone || "";
    document.getElementById("lead-value").value = lead.value ?? "";
    document.getElementById("lead-notes").value = lead.notes || "";
    fillStageSelect(lead.stage);
    fillServiceChecks(lead.services || []);
    btnDelete.hidden = false;
    modal.showModal();
  }

  function upsertFromForm() {
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
              <input type="number" min="0" max="365" value="${email.day}" data-field="day" />
            </label>
            <span class="seq-card__order">#${index + 1}</span>
            <label class="seq-toggle">
              <input type="checkbox" data-field="enabled" ${email.enabled !== false ? "checked" : ""} />
              Ενεργό
            </label>
            <button type="button" class="btn btn--sm btn--danger btn--ghost" data-action="delete">Διαγραφή</button>
          </header>
          <label class="field">
            <span>Θέμα</span>
            <input type="text" value="${escapeHtml(email.subject)}" data-field="subject" />
          </label>
          <label class="field">
            <span>Σώμα</span>
            <textarea rows="8" data-field="body">${escapeHtml(email.body)}</textarea>
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
              <button type="button" class="btn btn--sm" data-send="${lead.id}" ${
                !lead.email || !firstEmail ? "disabled" : ""
              }>Στείλε</button>
            </div>
          `
            )
            .join("")}
        </div>
        ${
          emails.length > 1
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
    if (!confirm("Επαναφορά όλων των sequences στα default templates;")) return;
    sequences = cloneDefaults();
    saveSequences();
    renderSequences();
  }

  function openEmailPreview(lead, email) {
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

  // Init
  fillStageSelect("lead");
  fillServiceChecks([]);
  load();
  renderBoard();
  setupOnboardingTab();
  }
})();
