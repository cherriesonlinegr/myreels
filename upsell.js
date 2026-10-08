(() => {
  const stay = window.MyReelsStay;
  const params = new URLSearchParams(window.location.search);
  const name = stay.cleanName(params.get("name"));
  const videoId = stay.parseYouTubeId(params.get("v"));
  const firstNet = stay.parseNet(params.get("p")) ?? stay.NET;
  const pack5 = stay.parseNet(params.get("p5")) ?? stay.PACK_5;
  const pack10 = stay.parseNet(params.get("p10")) ?? stay.PACK_10;
  const ready = document.getElementById("ready");
  const missing = document.getElementById("missing");
  const done = document.getElementById("done");

  if (!name) {
    missing.hidden = false;
    return;
  }

  const gross5 = stay.euro(stay.grossOf(pack5));
  const gross10 = stay.euro(stay.grossOf(pack10));
  const eachOf = (net, count) => stay.euro(Math.round((net / count) * 100) / 100);
  const each5 = eachOf(pack5, 5);
  const each10 = eachOf(pack10, 10);

  const owned = document.getElementById("owned-line");
  if (owned && name) owned.textContent = `Το Reel για το ${name} είναι δικό σου.`;
  document.getElementById("price-5").textContent = stay.euro(pack5);
  document.getElementById("price-10").textContent = stay.euro(pack10);
  document.getElementById("net-5").textContent = `${gross5} με ΦΠΑ`;
  document.getElementById("net-10").textContent = `${gross10} με ΦΠΑ`;
  document.getElementById("each-5").textContent = `${each5} / Reel`;
  document.getElementById("each-10").textContent = `${each10} / Reel`;
  const compare = document.getElementById("compare-line");
  if (compare) {
    compare.textContent = `1 Reel: ${stay.euro(firstNet)} + ΦΠΑ. Τα 5 βγαίνουν ${each5} το Reel. Τα 10 βγαίνουν ${each10} το Reel.`;
  }
  const labels = {
    5: `Θέλω τα 5 — ${stay.euro(pack5)}`,
    10: `Θέλω τα 10 — ${stay.euro(pack10)}`,
  };
  const paintLabels = () => {
    const card5 = document.getElementById("choose-5");
    const card10 = document.getElementById("choose-10");
    if (card5) card5.textContent = labels[5];
    if (card10) card10.textContent = labels[10];
  };
  paintLabels();
  document.title = `Τα επόμενα Reels για το ${name} · MyReels`;

  const errorEl = document.getElementById("form-error");
  const thanksLead = document.getElementById("thanks-lead");
  const buttons = () => [...document.querySelectorAll("[data-choose]")];

  document.getElementById("choose-5")?.addEventListener("click", () => payPack(5));
  document.getElementById("choose-10")?.addEventListener("click", () => payPack(10));

  document.getElementById("skip")?.addEventListener("click", () => {
    showDone(
      "Μένεις στο ένα.",
      `Η παραγγελία για το «${name}» έχει σταλεί. Σου στέλνουμε το αρχείο. Δεν χρειάζεται να κάνεις κάτι άλλο.`
    );
  });

  ready.hidden = false;
  if (thanksLead) thanksLead.textContent = "Η παραγγελία του πρώτου Reel στάλθηκε. Σου στέλνουμε το αρχείο.";

  function savedOrder() {
    try {
      const data = JSON.parse(sessionStorage.getItem("myreels_reel_order") || "");
      if (!data || !data.email || !data.name) return null;
      return data;
    } catch {
      return null;
    }
  }

  async function payPack(count) {
    if (errorEl) errorEl.hidden = true;
    const order = savedOrder();
    if (!order) {
      showError("Στείλε πρώτα την παραγγελία του πρώτου Reel από τη σελίδα του.");
      return;
    }
    buttons().forEach((button) => {
      button.disabled = true;
    });
    const chosen = document.getElementById(count === 10 ? "choose-10" : "choose-5");
    if (chosen) chosen.textContent = "Στέλνουμε την παραγγελία…";
    const netAmount = count === 10 ? pack10 : pack5;
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: order.name,
          business: order.property || name,
          email: order.email,
          services: [count === 10 ? "stay10" : "stay5"],
          source: "upsell",
          pack: count,
          priceNet: netAmount,
          notes: `${count} Reels και προγραμματισμός για το ${order.property || name}.`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Η παραγγελία δεν στάλθηκε.");
      }
      showDone(
        "Μπήκε και το πακέτο.",
        `Τα ${count} Reels για το «${order.property || name}» προστέθηκαν. Αναλαμβάνουμε και τον προγραμματισμό.`
      );
    } catch (err) {
      buttons().forEach((button) => {
        button.disabled = false;
      });
      paintLabels();
      showError(err?.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
    }
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function showDone(title, text) {
    ready.hidden = true;
    document.getElementById("done-title").textContent = title;
    document.getElementById("done-text").textContent = text;
    done.hidden = false;
    window.scrollTo(0, 0);
  }
})();
