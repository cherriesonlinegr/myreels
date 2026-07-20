(() => {
  /**
   * MyReels VSL — Hormozi structure (~6 min)
   * Replace VIDEO_URL with YouTube/Vimeo embed when ready, e.g.:
   * https://www.youtube.com/embed/VIDEO_ID?autoplay=1
   */
  const VIDEO_URL = ""; // ← βάλε εδώ embed URL όταν έχεις το βίντεο

  const SCRIPT = [
    {
      id: "hook",
      time: "0:00",
      title: "Hook",
      seconds: 0,
      lines: [
        "Αν η επιχείρησή σου αξίζει… πρέπει να φαίνεται.",
        "Γιατί το 80% των πελατών ψάχνει online πριν αποφασίσει πού θα πάει, πού θα φάει, από πού θα παραγγείλει.",
        "Και αν δεν σε βρίσκουν — βρίσκουν τον ανταγωνιστή σου.",
      ],
    },
    {
      id: "problem",
      time: "0:45",
      title: "Πρόβλημα",
      seconds: 45,
      lines: [
        "Οι περισσότεροι επιχειρηματίες ξέρουν ότι πρέπει να είναι στα Social και στο Google.",
        "Αλλά δεν έχουν χρόνο. Δεν ξέρουν τι να ανεβάσουν. Δεν θέλουν να είναι στην κάμερα.",
        "Αποτέλεσμα; Περιστασιακές δημοσιεύσεις. Χωρίς στρατηγική. Χωρίς συνέπεια.",
      ],
    },
    {
      id: "agitate",
      time: "1:30",
      title: "Agitation",
      seconds: 90,
      lines: [
        "Κάθε μέρα χωρίς παρουσία είναι μια μέρα που ο πελάτης βλέπει άλλον.",
        "Χάνεις κρατήσεις. Χάνεις delivery. Χάνεις τουρίστες. Χάνεις αξιοπιστία.",
        "Και δεν είναι θέμα ποιότητας υπηρεσίας. Είναι θέμα ορατότητας.",
      ],
    },
    {
      id: "solution",
      time: "2:15",
      title: "Λύση — MyReels",
      seconds: 135,
      lines: [
        "Εδώ μπαίνει το MyReels.",
        "Δεν είμαστε άλλο ένα social media agency που σου ζητάει συνέχεια stories.",
        "Είμαστε ο εξωτερικός συνεργάτης που αναλαμβάνει την ορατότητά σου — με τρία καθαρά προϊόντα.",
      ],
    },
    {
      id: "content",
      time: "2:50",
      title: "01 · Content Creation",
      seconds: 170,
      lines: [
        "Πρώτον: Content Creation.",
        "Φτιάχνουμε 12 επαγγελματικά βίντεο τον μήνα.",
        "Σενάρια, captions, hashtags — και τα ανεβάζουμε σε Facebook, Instagram και TikTok.",
        "Εσύ εγκρίνεις. Εμείς παράγουμε και δημοσιεύουμε.",
        "Αποτέλεσμα: σταθερή παρουσία, χωρίς να γίνεσαι creator.",
      ],
    },
    {
      id: "avatar",
      time: "3:40",
      title: "02 · AI Avatar Videos",
      seconds: 220,
      lines: [
        "Δεύτερον: AI Avatar Videos.",
        "Τριάντα βίντεο τον μήνα με ψηφιακό αντίγραφό σου — εικόνα και φωνή.",
        "Χωρίς συνεχή βιντεοσκόπηση. Χωρίς εσένα στην κάμερα.",
        "Το brand μιλάει… όσο εσύ δουλεύεις την επιχείρηση.",
      ],
    },
    {
      id: "maps",
      time: "4:25",
      title: "03 · Google Maps Growth",
      seconds: 265,
      lines: [
        "Τρίτον: Google Maps Growth.",
        "Επαγγελματικές φωτογραφίες και 4K βίντεο του χώρου σου.",
        "Πλήρες στήσιμο και βελτίωση του Google Business Profile.",
        "Συνεχής παρακολούθηση και άνοδος στην κατάταξη.",
        "Περισσότεροι πελάτες κάθε εβδομάδα — χωρίς διαφημιστικά έξοδα.",
      ],
    },
    {
      id: "stack",
      time: "5:10",
      title: "Offer stack",
      seconds: 310,
      lines: [
        "Μπορείς να ξεκινήσεις με μία υπηρεσία. Ή και με τις τρεις.",
        "Content για Social. Avatar για προσωπικό brand. Maps για τοπική κυριαρχία.",
        "Μαζί χτίζουν μια μηχανή ορατότητας που δουλεύει όσο εσύ κοιμάσαι.",
      ],
    },
    {
      id: "cta",
      time: "5:40",
      title: "Call to action",
      seconds: 340,
      lines: [
        "Αν θέλεις να δεις ποιο σου ταιριάζει — κλείσε ένα Discovery Call.",
        "Είκοσι λεπτά. Χωρίς δέσμευση. Βλέπουμε αν ταιριάζουμε.",
        "Πάτα το κουμπί κάτω από το βίντεο και πάμε.",
      ],
    },
  ];

  const TOTAL_SECONDS = 372; // ~6:12

  const frame = document.getElementById("video-frame");
  const btnPlay = document.getElementById("btn-play");
  const tele = document.getElementById("teleprompter");
  const teleLabel = document.getElementById("tele-label");
  const teleLine = document.getElementById("tele-line");
  const progressBar = document.getElementById("progress-bar");
  const chaptersEl = document.getElementById("chapters");
  const form = document.getElementById("vsl-form");
  const allBox = document.getElementById("vsl-all");

  let playing = false;
  let startTs = 0;
  let elapsed = 0;
  let raf = null;
  let lineIndex = 0;
  let chapterIndex = 0;

  // Flatten lines with chapter refs for teleprompter timing
  const flat = [];
  SCRIPT.forEach((ch, ci) => {
    const slice = Math.max(8, Math.floor(40 / ch.lines.length));
    ch.lines.forEach((line, li) => {
      flat.push({
        chapterIndex: ci,
        label: ch.title,
        text: line,
        at: ch.seconds + li * slice,
      });
    });
  });

  function renderChapters() {
    chaptersEl.innerHTML = SCRIPT.map(
      (ch, i) => `
      <article class="chapter" data-i="${i}">
        <button type="button" class="chapter__toggle" aria-expanded="false">
          <span class="chapter__time">${ch.time}</span>
          <span class="chapter__name">${ch.title}</span>
          <span class="chapter__chevron" aria-hidden="true">▾</span>
        </button>
        <div class="chapter__body">${ch.lines.join("\n\n")}</div>
      </article>
    `
    ).join("");

    chaptersEl.querySelectorAll(".chapter__toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const article = btn.closest(".chapter");
        const open = article.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function showLineForTime(t) {
    let current = flat[0];
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].at <= t) current = flat[i];
      else break;
    }
    if (!current) return;
    teleLabel.textContent = current.label;
    teleLine.textContent = current.text;
    chapterIndex = current.chapterIndex;
  }

  function tick(now) {
    if (!playing) return;
    elapsed = (now - startTs) / 1000;
    const pct = Math.min(100, (elapsed / TOTAL_SECONDS) * 100);
    progressBar.style.width = `${pct}%`;
    showLineForTime(elapsed);

    if (elapsed >= TOTAL_SECONDS) {
      stopPlayback(true);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function startTeleprompter() {
    frame.classList.add("is-playing");
    btnPlay.hidden = true;
    document.querySelector(".vsl-player__meta").hidden = true;
    tele.hidden = false;
    playing = true;
    startTs = performance.now() - elapsed * 1000;
    raf = requestAnimationFrame(tick);
  }

  function stopPlayback(ended) {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    if (ended) {
      teleLabel.textContent = "Τέλος";
      teleLine.textContent = "Κλείσε Discovery Call και πάμε να το φτιάξουμε.";
      progressBar.style.width = "100%";
    }
  }

  function startVideoEmbed(url) {
    frame.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.src = url.includes("?") ? `${url}&rel=0` : `${url}?rel=0&autoplay=1`;
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.title = "MyReels VSL";
    frame.appendChild(iframe);
    frame.classList.add("is-playing");
  }

  btnPlay.addEventListener("click", () => {
    const url = VIDEO_URL || frame.dataset.videoUrl;
    if (url) {
      startVideoEmbed(url);
      return;
    }
    // Demo mode: on-screen script teleprompter
    startTeleprompter();
  });

  // Interest checkboxes
  if (form) {
    const serviceBoxes = () =>
      [...form.querySelectorAll('input[name="interest"]')].filter((el) => el.value !== "all");

    form.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.name !== "interest") return;
      if (t.value === "all") {
        serviceBoxes().forEach((b) => {
          b.checked = t.checked;
        });
      } else if (allBox) {
        allBox.checked = serviceBoxes().every((b) => b.checked);
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const business = String(data.get("business") || "").trim();
      const email = String(data.get("email") || "").trim();
      const phone = String(data.get("phone") || "").trim();

      let services = data.getAll("interest").map(String).filter((v) => v !== "all");
      if (data.getAll("interest").includes("all") || services.length === 3) {
        services = ["content", "videos", "maps"];
      }

      const labels = {
        content: "Διαχείριση Social Media",
        videos: "AI Avatar Videos",
        avatar: "AI Avatar Videos",
        maps: "Google My Business",
      };
      const interestNote = services.length
        ? `Ενδιαφέρον: ${services.map((id) => labels[id] || id).join(", ")}`
        : "Ενδιαφέρον: δεν επιλέχθηκε";

      try {
        const key = "myreels_leads";
        const raw = localStorage.getItem(key);
        const leads = raw ? JSON.parse(raw) : [];
        leads.unshift({
          id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          business,
          email,
          phone,
          stage: "lead",
          services,
          value: null,
          notes: `Από VSL page. ${interestNote}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        localStorage.setItem(key, JSON.stringify(leads));
      } catch {
        /* ignore */
      }

      try {
        await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            business,
            email,
            phone,
            services,
            source: "vsl",
            notes: interestNote,
          }),
        });
      } catch {
        /* ignore */
      }

      form.classList.add("is-success");
      form.innerHTML = name
        ? `Ευχαριστούμε, ${name}. Θα επικοινωνήσουμε σύντομα.`
        : "Ευχαριστούμε. Θα επικοινωνήσουμε σύντομα.";
    });
  }

  renderChapters();
})();
