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

  const LANG_KEY = "myreels_lang";

  const setLang = (lang) => {
    const value = lang === "en" ? "en" : "el";
    try {
      sessionStorage.setItem(LANG_KEY, value);
      sessionStorage.setItem("myreels_lang_lock", value);
    } catch {
      /* a private window can still render the page */
    }
    return value;
  };

  const clearLangLock = () => {
    try {
      sessionStorage.removeItem("myreels_lang_lock");
    } catch {
      /* the path decides until a property is found */
    }
  };

  const currentLang = () => {
    let path = "";
    try {
      path = location.pathname || "";
    } catch {
      path = "";
    }
    try {
      const locked = sessionStorage.getItem("myreels_lang_lock");
      if (locked === "en" || locked === "el") return locked;
    } catch {
      /* fall through to the path */
    }
    const remember = (value) => {
      try {
        sessionStorage.setItem(LANG_KEY, value);
      } catch {
        /* a private window can still render the page */
      }
      return value;
    };
    if (/^\/en(\/|$)/.test(path)) return remember("en");
    if (/^\/(?:luxurystayreels|myairbnbreels)(\/|$)/.test(path)) return remember("el");
    try {
      return sessionStorage.getItem(LANG_KEY) === "en" ? "en" : "el";
    } catch {
      return "el";
    }
  };

  const moneyLang = (lang) => {
    if (lang === "en" || lang === "el") return lang;
    try {
      const path = location.pathname || "";
      if (/^\/en(\/|$)/.test(path)) return "en";
      if (path === "/upsell" || path.startsWith("/upsell/")) {
        return sessionStorage.getItem(LANG_KEY) === "en" ? "en" : "el";
      }
    } catch {
      /* the admin keeps Greek figures */
    }
    return "el";
  };

  const euro = (amount, lang) => {
    const cents = Math.round(Number(amount) * 100);
    const hasDecimals = cents % 100 !== 0;
    const formatted = new Intl.NumberFormat(moneyLang(lang) === "en" ? "en-GB" : "el-GR", {
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
    headline: "Το Reel του «{name}» είναι ήδη έτοιμο.",
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
    cta: "Θέλω το Reel — {gross} με ΦΠΑ",
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
    yes: "Ναι, θέλω τα 10 και τη διαχείριση — {extraGross} με ΦΠΑ",
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
    yes: "Ναι, θέλω τα 5 — {extraGross} με ΦΠΑ",
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
    title: "Δες τι φτιάχνουμε για τους πελάτες μας.",
    lead: "Εννέα Reels, από εννέα καταλύματα.",
  };
  for (let index = 1; index <= 9; index += 1) {
    sampleFields.push({ key: `n${index}`, label: `Όνομα ${index}`, kind: "line", max: 80 });
    sampleFields.push({ key: `v${index}`, label: `YouTube ${index}`, kind: "line", max: 200 });
    SAMPLES[`n${index}`] = `Δείγμα ${index}`;
    SAMPLES[`v${index}`] = index === 1 ? "https://youtube.com/shorts/TIuYOdwenhY" : "";
  }

  const EN_COPY = {
    label: "For {name}",
    headline: "The Reel for «{name}» is ready.",
    sub: "We made it from the photos you already have online. No shoot. Nothing you had to do.",
    pitchTitle: "And the best part? Nobody had to film it.",
    pitch:
      "We took the photos of your property and made a Reel where a model moves through the space. You didn't have to book a shoot, appear on camera, or send new footage.",
    priceTitle: "And the price?",
    priceYes: "Yes. For the whole Reel.",
    priceNote:
      "This isn't a discount off some \"regular price\". There's no trick. We already made it for your property, and we want you to see what we can do. So yes, it's inexpensive. On purpose.",
    formTitle: "Want it? It's yours.",
    formSub: "Add your details and pay by card. Once the payment goes through, we send you the file.",
    cta: "I want the Reel — {gross} incl. VAT",
    micro: "No appointment. No shoot. No fuss.",
    ps: "P.S. Honestly, this film shouldn't be going out at this price. If you don't want it, pretend you never saw it. We'll do the same.",
  };

  const EN_UP10 = {
    kicker: "The first Reel is yours",
    title: "We made the first one. Why stop there?",
    owned: "The Reel for {name} is yours.",
    lead: "We can make 10 Reels in total for your property, and run your socials for the next 2 months.",
    perks: [
      "10 Reels in total, including the one you just bought.",
      "Full social management for 2 months.",
      "We write the posts and the hashtags, and schedule them on Instagram, Facebook and TikTok.",
      "About one post every 2–3 days.",
    ].join("\n"),
    context: "The pack is {pack} + VAT. You've already paid {net} + VAT. You pay the difference now.",
    yes: "Yes, I want the 10 and the management — {extraGross} incl. VAT",
    no: "Not now. I'll stay with the Reel I bought.",
  };

  const EN_UP5 = {
    kicker: "A smaller option",
    title: "Want 5 Reels ready to post?",
    owned: "The Reel for {name} is yours.",
    lead: "Keep the first Reel and add four more. Five videos for your property, with no new shoot and no posting schedule.",
    perks: [
      "5 Reels in total, including the one you bought.",
      "More sides of the place, from the photos you already have.",
      "The 2 months of social management are only in the pack of 10.",
    ].join("\n"),
    context: "The pack is {pack} + VAT. You've already paid {net} + VAT. You pay the difference now.",
    yes: "Yes, I want the 5 — {extraGross} incl. VAT",
    no: "No, I'll stay with the first Reel.",
  };

  const EN_DONE = {
    tenTitle: "You now have 10 Reels.",
    tenText:
      "The upgrade is complete for «{name}». 10 Reels in total, and full social management for 2 months: posts, hashtags and scheduling on Instagram, Facebook and TikTok. It hasn't started yet.",
    fiveTitle: "You now have 5 Reels.",
    fiveText:
      "The upgrade is complete for «{name}». 5 Reels in total. This pack does not include a posting schedule. We'll send you the files.",
    oneTitle: "Your order is complete.",
    oneText: "The Reel for «{name}» is yours. We'll send you the file. There's nothing else you need to do.",
  };

  const EN_SAMPLES = {
    ...SAMPLES,
    title: "See what we make for our clients.",
    lead: "Nine Reels, from nine properties.",
  };

  const EN_FACTORY = {
    landing: EN_COPY,
    up10: EN_UP10,
    up5: EN_UP5,
    done: EN_DONE,
    samples: EN_SAMPLES,
  };

  const UI = {
    el: {
      play: "Παίξε το Reel",
      pause: "Σταμάτα το Reel",
      mute: "Κλείσε τον ήχο",
      unmute: "Άνοιξε τον ήχο",
      vat: "με ΦΠΑ",
      fullName: "Ονοματεπώνυμο",
      property: "Όνομα καταλύματος",
      email: "Email",
      phone: "Τηλέφωνο",
      phonePh: "69xxxxxxxx",
      receipt: "Απόδειξη",
      invoice: "Τιμολόγιο",
      afm: "ΑΦΜ",
      privacy: 'Αποδέχομαι την <a href="/privacy.html" target="_blank" rel="noopener">Πολιτική Απορρήτου</a>.',
      payNote: "Η πληρωμή γίνεται με κάρτα, στο επόμενο βήμα.",
      missingTitle: "Αυτή η σελίδα δεν ανοίγει για πληρωμή.",
      missingText: "Το κατάλυμα δεν είναι αποθηκευμένο σε αυτό το site. Άνοιξε το link από το admin, με το «Άνοιγμα σελίδας».",
      privacyName: "Πολιτική Απορρήτου",
      contact: "επικοινωνία στο",
      cookie: 'Χρησιμοποιούμε cookies. <a href="/privacy.html">Πολιτική Απορρήτου</a>',
      cookieYes: "Αποδοχή",
      playSample: "Παίξε το δείγμα {name}",
      sample: "Δείγμα",
      reviews: "Κριτικές",
      starsOf: "{n} από 5",
      reviewN: "Κριτική {n}",
      privacyCheck: "Τσέκαρε ότι αποδέχεσαι την Πολιτική Απορρήτου.",
      afmInvalid: "Βάλε ένα σωστό ΑΦΜ για να βρεθούν τα στοιχεία του τιμολογίου.",
      phoneInvalid: "Γράψε ένα τηλέφωνο.",
      fieldsMissing: "Συμπλήρωσε όλα τα πεδία.",
      paying: "Μετάβαση στην πληρωμή…",
      payClosed: "Η πληρωμή δεν άνοιξε.",
      payFailed: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
      afmLooking: "Ψάχνω τα στοιχεία…",
      afmMissing: "Δεν βρέθηκαν στοιχεία για αυτό το ΑΦΜ.",
      afmDown: "Η αναζήτηση ΑΦΜ δεν απάντησε. Δοκίμασε ξανά.",
      yourPlace: "το κατάλυμά σου",
      continueFor: "Συνέχεια για το {name}",
      upgradeUnavailable: "Αυτή η αναβάθμιση δεν είναι διαθέσιμη για αυτή την τιμή.",
      firstNotPaid: "Η πληρωμή του πρώτου Reel δεν ολοκληρώθηκε.",
      packNotPaid: "Η πληρωμή δεν ολοκληρώθηκε. Το αρχικό σου Reel παραμένει αγορασμένο. Μπορείς να δοκιμάσεις ξανά ή να συνεχίσεις μόνο με την αρχική παραγγελία.",
      beat1: "Η πληρωμή σου ολοκληρώθηκε.",
      beat2: "Το Reel για το «{name}» είναι δικό σου!",
      beat3: "Μην κλείσεις τη σελίδα.",
      beat4: "Έχουμε μια πρόταση που, ειλικρινά, δεν πρέπει να χάσεις!",
      payUnconfirmed: "Η πληρωμή δεν επιβεβαιώθηκε.",
      payBack: "Δεν ολοκληρώθηκε. Γύρνα στη σελίδα του καταλύματος και δοκίμασε ξανά.",
      payRefresh: "Αν την ολοκλήρωσες, ανανέωσε σε λίγο.",
      orderLine: "Η παραγγελία σου",
      continueOrder: "Συνέχεια παραγγελίας",
      linkIncomplete: "Αυτό το link δεν είναι πλήρες.",
      needName: "Χρειάζεται το όνομα του καταλύματος.",
      yoursLine: "Το πρώτο Reel είναι δικό σου",
      rateTitle: "Αξιολόγησε το Reel",
      rateLead: "",
      rateLegend: "Η ΒΑΘΜΟΛΟΓΙΑ ΣΟΥ",
      pickStars: "Πώς σου φάνηκε η εμπειρία; 5 αστεράκια και ένα όμορφο review είναι ό,τι καλύτερο.",
      yourMessage: "Το μήνυμά σου",
      optional: "Προαιρετικό.",
      messagePh: "Π.χ. «Το Reel έπιασε ακριβώς το κατάλυμα.»",
      placeLabel: "Κατάλυμα",
      hideName: "Προτιμώ να μην φαίνεται το ονοματεπώνυμό μου στην ιστοσελίδα.",
      submitReview: "Υποβολή αξιολόγησης",
      thanks: "Ευχαριστούμε.",
      reviewHave: "Την έχουμε ήδη.",
      reviewSeen: "Την είδαμε. Αν την εγκρίνουμε, θα φανεί πάνω από τα δείγματα.",
      notSent: "Δεν στάλθηκε.",
      pickStarsError: "Διάλεξε από 1 έως 5 αστέρια.",
    },
    en: {
      play: "Play the Reel",
      pause: "Pause the Reel",
      mute: "Mute",
      unmute: "Sound on",
      vat: "incl. VAT",
      fullName: "Full name",
      property: "Property name",
      email: "Email",
      phone: "Phone",
      phonePh: "+30 69xxxxxxxx",
      receipt: "Receipt",
      invoice: "Invoice",
      afm: "VAT number",
      privacy: 'I accept the <a href="/en/privacy" target="_blank" rel="noopener">Privacy policy</a>.',
      payNote: "You'll pay by card on the next step.",
      missingTitle: "This page isn't open for payment.",
      missingText: "This property isn't saved on the site. Open the link from the admin, with «Open page».",
      privacyName: "Privacy policy",
      contact: "write to",
      cookie: 'We use cookies. <a href="/en/privacy">Privacy policy</a>',
      cookieYes: "Accept",
      playSample: "Play the {name} sample",
      sample: "Sample",
      reviews: "Reviews",
      starsOf: "{n} out of 5",
      reviewN: "Review {n}",
      privacyCheck: "Tick that you accept the Privacy policy.",
      afmInvalid: "Enter a valid Greek VAT number so we can find the invoice details.",
      phoneInvalid: "Enter a phone number.",
      fieldsMissing: "Fill in every field.",
      paying: "Taking you to payment…",
      payClosed: "The payment didn't open.",
      payFailed: "Something went wrong. Try again.",
      afmLooking: "Looking up the details…",
      afmMissing: "No details found for this VAT number.",
      afmDown: "The VAT lookup didn't answer. Try again.",
      yourPlace: "your property",
      continueFor: "Continue for {name}",
      upgradeUnavailable: "This upgrade isn't available at this price.",
      firstNotPaid: "The payment for the first Reel didn't go through.",
      packNotPaid: "The payment didn't go through. The first Reel is still yours. You can try again, or stay with the original order.",
      beat1: "Your payment went through.",
      beat2: "The Reel for «{name}» is yours.",
      beat3: "Don't close the page.",
      beat4: "We have an offer that, honestly, you shouldn't miss.",
      payUnconfirmed: "The payment wasn't confirmed.",
      payBack: "It didn't go through. Go back to the property page and try again.",
      payRefresh: "If you did pay, refresh in a moment.",
      orderLine: "Your order",
      continueOrder: "Order",
      linkIncomplete: "This link is incomplete.",
      needName: "It needs the property name.",
      yoursLine: "The first Reel is yours",
      rateTitle: "Rate the Reel",
      rateLead: "",
      rateLegend: "YOUR RATING",
      pickStars: "How was the experience? Five stars and a kind review would mean a lot.",
      yourMessage: "Your message",
      optional: "Optional.",
      messagePh: "For example, “The Reel caught the place exactly.”",
      placeLabel: "Property",
      hideName: "I'd rather my full name didn't appear on the site.",
      submitReview: "Send rating",
      thanks: "Thank you.",
      reviewHave: "We already have it.",
      reviewSeen: "We have it. If we approve it, it will appear above the samples.",
      notSent: "It wasn't sent.",
      pickStarsError: "Pick from 1 to 5 stars.",
    },
  };

  const t = (key) => {
    const pack = UI[currentLang()] || UI.el;
    if (pack && Object.prototype.hasOwnProperty.call(pack, key)) return pack[key];
    return Object.prototype.hasOwnProperty.call(UI.el, key) ? UI.el[key] : "";
  };

  const applyChrome = () => {
    const lang = currentLang();
    if (document.documentElement) document.documentElement.lang = lang === "en" ? "en" : "el";
    document.querySelectorAll("[data-ui]").forEach((node) => {
      const key = node.getAttribute("data-ui");
      if (!key || (!Object.prototype.hasOwnProperty.call(UI.el, key) && !Object.prototype.hasOwnProperty.call(UI.en, key))) return;
      const value = t(key);
      if (node.hasAttribute("data-ui-html")) node.innerHTML = value;
      else node.textContent = value;
    });
    document.querySelectorAll("[data-ui-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-ui-placeholder");
      if (key) node.setAttribute("placeholder", t(key));
    });
    document.querySelectorAll("[data-ui-label]").forEach((node) => {
      const key = node.getAttribute("data-ui-label");
      if (key) node.setAttribute("aria-label", t(key));
    });
    document.querySelectorAll("[data-privacy-href]").forEach((node) => {
      node.setAttribute("href", lang === "en" ? "/en/privacy" : "/privacy.html");
    });
  };

  const localError = (message, key) => {
    const text = String(message || "").trim();
    if (currentLang() === "en" && /[Α-Ωα-ωΆ-ώ]/.test(text)) return t(key);
    return text || t(key);
  };

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

  const LEGACY = {
    landing: { cta: ["Θέλω το Reel — {net}"] },
    up10: { yes: ["Ναι, θέλω τα 10 και τη διαχείριση — {extra}"] },
    up5: { yes: ["Ναι, θέλω τα 5 — {extra}"] },
  };

  const normalizePage = (page, source, base, language) => {
    const factoryCopy = base || page.copy;
    const copy = {};
    page.fields.forEach((field) => {
      const has = source && Object.prototype.hasOwnProperty.call(source, field.key);
      const stored = has ? cleanCopyValue(source[field.key], field.max) : "";
      const retired = language === "en" ? [] : (LEGACY[page.id] && LEGACY[page.id][field.key]) || [];
      copy[field.key] = has && !retired.includes(stored) ? stored : factoryCopy[field.key];
    });
    return copy;
  };

  const normalizeCopy = (input) => normalizePage(pageById("landing"), input);

  const normalizePages = (input, lang) => {
    const language = lang === "en" ? "en" : "el";
    const source = input && typeof input === "object" ? input : null;
    const own = language === "en" ? (source?.en && typeof source.en === "object" ? source.en : null) : source;
    const nested = language === "el" && own && COPY_PAGES.some((page) => own[page.id] && typeof own[page.id] === "object");
    const factory = language === "en" ? EN_FACTORY : null;
    const pages = {};
    COPY_PAGES.forEach((page) => {
      let pageSource = null;
      if (language === "en") {
        pageSource = own && own[page.id] && typeof own[page.id] === "object" ? { ...own[page.id] } : null;
        if (page.id === "samples" && source?.samples && typeof source.samples === "object") {
          const names = {};
          for (let index = 1; index <= 9; index += 1) {
            ["n", "v"].forEach((prefix) => {
              const key = `${prefix}${index}`;
              if (Object.prototype.hasOwnProperty.call(source.samples, key)) names[key] = source.samples[key];
            });
          }
          pageSource = { ...names, ...(pageSource || {}) };
        }
      } else {
        pageSource = nested ? own[page.id] : page.id === "landing" ? own : null;
      }
      pages[page.id] = normalizePage(page, pageSource, factory ? factory[page.id] : page.copy, language);
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

  const resolvePages = (raw, lang) => normalizePages(decodeCopy(raw), lang);
  const resolveCopy = (raw) => resolvePages(raw).landing;

  const mergeSamples = (base, overrides) => {
    const next = { ...(base || {}) };
    if (!overrides || typeof overrides !== "object") return next;
    for (let index = 1; index <= 9; index += 1) {
      ["n", "v"].forEach((prefix) => {
        const key = `${prefix}${index}`;
        if (!Object.prototype.hasOwnProperty.call(overrides, key)) return;
        const field = sampleFields.find((item) => item.key === key);
        next[key] = cleanCopyValue(overrides[key], field?.max || 200);
      });
    }
    return next;
  };

  const fillTokens = (template, vars) => {
    let text = String(template ?? "");
    const name = vars?.name || "";
    if (!name) {
      text = text
        .replaceAll(" για το «{name}»", "")
        .replaceAll(" για το {name}", "")
        .replaceAll(" του «{name}»", "")
        .replaceAll(" for «{name}»", "")
        .replaceAll(" for {name}", "");
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

  const localSample = () => ["localhost", "127.0.0.1"].includes(location.hostname);

  const workFace = (item) => {
    if (localSample()) {
      return `<button type="button" class="reel-tile__face reel-tile__face--local" data-work-local="1" aria-label="${escapeHtml(fillTokens(t("playSample"), { name: item.name }))}"><video src="/local-sample.mp4#t=0.1" loop playsinline preload="metadata"></video><span class="reel-tile__badge" aria-hidden="true"></span></button>`;
    }
    if (!item.videoId) {
      return `<div class="reel-tile__face reel-tile__face--empty" aria-hidden="true"><svg viewBox="0 0 40 40"><rect width="40" height="40" rx="13" fill="#FF5A5F"/><path fill="#fff" d="M9 19.2 20 10l11 9.2V30.2c0 1.1-.9 2-2 2H11c-1.1 0-2-.9-2-2V19.2z"/><path fill="#FF5A5F" d="M17.2 32.2v-5.4a2.8 2.8 0 0 1 5.6 0v5.4"/></svg></div>`;
    }
    return `<button type="button" class="reel-tile__face" data-work-video="${escapeHtml(item.videoId)}" aria-label="${escapeHtml(fillTokens(t("playSample"), { name: item.name }))}"><img src="https://i.ytimg.com/vi/${escapeHtml(item.videoId)}/hqdefault.jpg" alt="" /><span class="reel-tile__badge" aria-hidden="true"></span></button>`;
  };

  const mountWork = (container, pageKey, samples, options) => {
    if (!container) return;
    const order = WORK_ORDER[pageKey] || WORK_ORDER.landing;
    const paint = (source) => {
    const items = workItems(source);
    const title = fillTokens(source?.title, {}).trim();
    const lead = fillTokens(source?.lead, {}).trim();
    const tiles = order
      .map((index) => items[index])
      .filter(Boolean)
      .map(
        (item) =>
          `<figure class="reel-tile" data-work-id="${escapeHtml(item.videoId)}" data-work-name="${escapeHtml(item.name)}">${workFace(item)}<figcaption>${escapeHtml(item.name)}</figcaption></figure>`
      )
      .join("");
    const starRow = (count) => {
      const n = Math.max(0, Math.min(5, Number(count) || 0));
      return `<span class="quote__stars" aria-label="${escapeHtml(t("starsOf").replaceAll("{n}", String(n)))}"><span class="is-on">${"★".repeat(n)}</span><span>${"★".repeat(5 - n)}</span></span>`;
    };
    const featured = [
      {
        stars: 5,
        name: "Ελένη Μαυροπούλου",
        property: "Το Πέτρινο",
        message: "Το Reel ανέδειξε την ατμόσφαιρα του καταλύματος μας πολύ καλύτερα από τις απλές φωτογραφίες. Απογείωσε την εικόνα μας! Σας ευχαριστούμε!",
      },
      {
        stars: 5,
        name: "Γιώργος",
        property: "The Loft",
        message: "Το ανέβασα την ίδια κιόλας μέρα! Μετέτρεψαν τις φωτογραφίες μου σε επαγγελματικό βίντεο χωρίς να χρειαστεί να κουνήσω το δάχτυλό μου. Απλά υπέροχο!",
      },
      {
        stars: 5,
        name: "Μαρία Κωνσταντίνου",
        property: "Villa Mare",
        message: "Το μεγαλύτερο πρόβλημά μου ήταν ότι δεν είχα χρόνο για γυρίσματα. Το βίντεο ήταν έτοιμο, η ποιότητα εξαιρετική και το ανέβασα αμέσως. Εξαιρετικό Value for money!",
      },
      {
        stars: 5,
        name: "Γιάννης Μιχαλόπουλος",
        property: "Traditional Guesthouse Πήλιο",
        message: "Ήμουν επιφυλακτικός στην αρχή, αλλά μόλις είδα το κατάλυμά μου στο βίντεο, το αγόρασα στη στιγμή.\nΔεν περίμενα ότι από τις απλές φωτογραφίες του site μου θα έβγαινε τέτοιο αποτέλεσμα. Είναι ό,τι πιο vfm έχω αγοράσει για το μάρκετινγκ του σπιτιού.",
      },
    ];
    const placeQuotes = () => {
      const host = document.querySelector("[data-quotes]");
      const form = document.getElementById("order");
      if (!host || !form || host.parentElement !== container && host.parentElement !== form.parentElement) return;
      if (window.matchMedia("(max-width: 959px)").matches) form.before(host);
      else container.prepend(host);
    };
    if (!document.documentElement.dataset.quotesPark) {
      document.documentElement.dataset.quotesPark = "1";
      window.addEventListener("resize", placeQuotes);
    }
    const paintQuotes = (extra) => {
      const host = container.querySelector("[data-quotes]") || document.querySelector("[data-quotes]");
      if (!host) return;
      const seen = new Set(featured.map((item) => item.message));
      const live = (extra || []).filter((item) => item?.message && !seen.has(item.message));
      const list = live.concat(featured);
      host.hidden = false;
      host.innerHTML = `<h2 class="quotes__title">${escapeHtml(t("reviews"))}</h2><div class="quotes__grid" tabindex="0" aria-label="${escapeHtml(t("reviews"))}">${list
        .map(
          (item) =>
            `<figure class="quote">${starRow(item.stars)}${item.message ? `<blockquote>${escapeHtml(item.message)}</blockquote>` : ""}<figcaption>${escapeHtml([item.name, item.property].filter(Boolean).join(" · "))}</figcaption></figure>`
        )
        .join("")}</div><div class="quotes__dots"></div>`;
      const scroller = host.querySelector(".quotes__grid");
      const dots = host.querySelector(".quotes__dots");
      const cards = [...scroller.children];
      dots.innerHTML = cards
        .map((_, index) => `<button type="button" class="quotes__dot${index === 0 ? " is-on" : ""}" aria-label="${escapeHtml(t("reviewN").replaceAll("{n}", String(index + 1)))}"></button>`)
        .join("");
      const mark = () => {
        const width = cards[0]?.getBoundingClientRect().width || scroller.clientWidth || 1;
        const index = Math.max(0, Math.min(cards.length - 1, Math.round(scroller.scrollLeft / (width + 12))));
        dots.querySelectorAll(".quotes__dot").forEach((dot, dotIndex) => dot.classList.toggle("is-on", dotIndex === index));
      };
      scroller.addEventListener("scroll", mark, { passive: true });
      dots.addEventListener("click", (event) => {
        const dot = event.target.closest(".quotes__dot");
        if (!dot) return;
        const index = [...dots.children].indexOf(dot);
        const width = cards[0]?.getBoundingClientRect().width || scroller.clientWidth;
        scroller.scrollTo({ left: index * (width + 12), behavior: "smooth" });
      });
      container.hidden = false;
      placeQuotes();
    };
    document.querySelectorAll("[data-quotes]").forEach((node) => {
      if (!container.contains(node)) node.remove();
    });
    const quotesOn = currentLang() !== "en";
    container.innerHTML = `${quotesOn ? `<div class="quotes" data-quotes hidden></div>` : ""}${title ? `<h2 class="work__title">${escapeHtml(title)}</h2>` : ""}${lead ? `<p class="work__lead">${escapeHtml(lead)}</p>` : ""}<div class="work__grid">${tiles}</div>`;
    container.hidden = !title && !lead && !tiles;
    if (quotesOn) {
      paintQuotes([]);
      fetch("/api/review?list=1", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload) => {
          paintQuotes(Array.isArray(payload?.reviews) ? payload.reviews : []);
        })
        .catch(() => {});
    }
    container.querySelectorAll("[data-work-local] video").forEach((video) => {
      video.pause();
    });
    };
    const paintMerged = (base) => paint(mergeSamples(base, options?.overrides));
    paintMerged(samples);
    if (options?.live !== false && container.dataset.copyFetch !== "1") {
      container.dataset.copyFetch = "1";
      fetch("/api/reel-config?samples=1", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload) => {
          if (!payload?.copy) return;
          paintMerged(resolvePages(payload.copy, currentLang()).samples);
        })
        .catch(() => {});
    }
    if (container.dataset.workBound === "1") return;
    container.dataset.workBound = "1";
    container.addEventListener("click", (event) => {
      const localButton = event.target.closest("[data-work-local]");
      if (localButton && container.contains(localButton)) {
        const video = localButton.querySelector("video");
        if (!video) return;
        const playing = localButton.classList.contains("is-playing") && !video.paused;
        container.querySelectorAll("[data-work-local]").forEach((button) => {
          const other = button.querySelector("video");
          if (other) other.pause();
          button.classList.remove("is-playing");
        });
        if (playing) return;
        document.dispatchEvent(new CustomEvent("myreels-work-play"));
        localButton.classList.add("is-playing");
        if (window.innerWidth <= 959) localButton.closest("figure")?.scrollIntoView({ behavior: "smooth", block: "center" });
        video.muted = false;
        video.volume = 1;
        const started = video.play();
        if (started && typeof started.catch === "function") {
          started.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
        return;
      }
      const button = event.target.closest("[data-work-video]");
      if (!button || !container.contains(button)) return;
      if (window.MyReelsCookies && window.MyReelsCookies.choice() !== "all") {
        window.MyReelsCookies.ask();
        return;
      }
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
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=0&loop=1&playlist=${encodeURIComponent(videoId)}&controls=0&modestbranding=1&rel=0&playsinline=1`;
      iframe.title = figure.getAttribute("data-work-name") || t("sample");
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.setAttribute("allowfullscreen", "");
      frame.appendChild(iframe);
      button.replaceWith(frame);
      document.dispatchEvent(new CustomEvent("myreels-work-play"));
      if (window.innerWidth <= 959) figure.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.addEventListener("myreels-hero-play", () => {
      container.querySelectorAll("[data-work-local]").forEach((button) => {
        const video = button.querySelector("video");
        if (video) video.pause();
        button.classList.remove("is-playing");
      });
      container.querySelectorAll(".reel-tile__frame").forEach((playing) => {
        const host = playing.closest("figure");
        if (!host) return;
        const id = host.getAttribute("data-work-id") || "";
        const name = host.getAttribute("data-work-name") || "";
        playing.replaceWith(document.createRange().createContextualFragment(workFace({ videoId: id, name })).firstChild);
      });
    });
  };

  const packNet = (value, fallback) => parseNet(value) ?? fallback;

  const latinSlug = (value) => {
    let text = String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    [
      ["ου", "ou"],
      ["αυ", "av"],
      ["ευ", "ev"],
      ["μπ", "b"],
      ["ντ", "nt"],
      ["γκ", "gk"],
      ["γγ", "ng"],
      ["τσ", "ts"],
      ["τζ", "tz"],
    ].forEach(([from, to]) => {
      text = text.replaceAll(from, to);
    });
    const letters = {
      α: "a",
      β: "b",
      γ: "g",
      δ: "d",
      ε: "e",
      ζ: "z",
      η: "i",
      θ: "th",
      ι: "i",
      κ: "k",
      λ: "l",
      μ: "m",
      ν: "n",
      ξ: "x",
      ο: "o",
      π: "p",
      ρ: "r",
      σ: "s",
      ς: "s",
      τ: "t",
      υ: "i",
      φ: "f",
      χ: "ch",
      ψ: "ps",
      ω: "o",
    };
    return [...text]
      .map((ch) => letters[ch] || ch)
      .join("")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80);
  };

  const stayPathName = (value) => latinSlug(cleanName(value));

  const landingSlug = (name, taken) => {
    const base = stayPathName(name);
    if (!base) return "";
    const used = new Set((Array.isArray(taken) ? taken : []).map((item) => String(item || "")));
    if (!used.has(base)) return base;
    let candidate = `${base}_gr`;
    let extra = 2;
    while (used.has(candidate)) {
      candidate = `${base}_gr${extra}`;
      extra += 1;
    }
    return candidate;
  };

  const buildLandingUrl = (origin, slug, lang) => {
    const path = stayPathName(slug);
    const prefix = lang === "en" ? "/en" : "";
    return `${String(origin || "").replace(/\/$/, "")}${prefix}/luxurystayreels/${path}`;
  };

  const buildDraftLandingUrl = (origin, name, videoId, net, copy, packs) => {
    const url = new URL(buildLandingUrl(origin, name, packs?.lang));
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
    const prefix = packs?.lang === "en" ? "/en" : "";
    const url = new URL(`${prefix}/upsell`, origin);
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
    mergeSamples,
    encodeCopy,
    resolveCopy,
    resolvePages,
    fillTokens,
    mountWork,
    slugify: stayPathName,
    landingSlug,
    buildLandingUrl,
    buildDraftLandingUrl,
    buildUpsellUrl,
    currentLang,
    setLang,
    clearLangLock,
    t,
    applyChrome,
    localError,
  };
})();
