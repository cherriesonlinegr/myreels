(() => {
  const nav = document.getElementById("nav");
  const year = document.getElementById("year");
  const form = document.getElementById("cta-form");
  const sticky = document.getElementById("sticky-cta");
  const cta = document.getElementById("cta");
  const burger = document.getElementById("nav-burger");
  const navLinks = document.getElementById("nav-links");

  if (burger && nav) {
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks?.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (year) year.textContent = String(new Date().getFullYear());

  const onScroll = () => {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);

    if (sticky && cta) {
      const heroBottom = window.innerHeight * 0.7;
      const ctaTop = cta.getBoundingClientRect().top;
      const show = window.scrollY > heroBottom && ctaTop > window.innerHeight;
      sticky.hidden = false;
      sticky.classList.toggle("is-visible", show);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  document.querySelectorAll(".hero .reveal").forEach((el) => {
    el.classList.add("is-visible");
  });

  if (form) {
    const allBox = document.getElementById("interest-all");
    const serviceBoxes = () =>
      [...form.querySelectorAll('input[name="interest"]')].filter(
        (el) => el.value !== "all"
      );

    form.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.name !== "interest") return;

      if (t.value === "all") {
        serviceBoxes().forEach((box) => {
          box.checked = t.checked;
        });
        return;
      }

      if (allBox) {
        allBox.checked = serviceBoxes().every((box) => box.checked);
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Αποστολή…";
      }

      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const business = String(data.get("business") || "").trim();
      const email = String(data.get("email") || "").trim();
      const phone = String(data.get("phone") || "").trim();

      let services = data
        .getAll("interest")
        .map(String)
        .filter((v) => v !== "all");
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

      // Local admin pipeline
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
          notes: `Από landing page — Discovery Call. ${interestNote}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        localStorage.setItem(key, JSON.stringify(leads));
      } catch {
        /* ignore */
      }

      // Email via Resend (Vercel API — myreels project only)
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
            source: "landing",
            notes: interestNote,
          }),
        });
      } catch {
        /* form still succeeds locally if email fails */
      }

      form.classList.add("is-success");
      form.innerHTML = name
        ? `Ευχαριστούμε, ${name}. Θα επικοινωνήσουμε εντός 24 ωρών.`
        : "Ευχαριστούμε. Θα επικοινωνήσουμε σύντομα.";
    });
  }
})();
