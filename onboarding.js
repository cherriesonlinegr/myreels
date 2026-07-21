(() => {
  const form = document.getElementById("onboarding-form");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const map = {
    leadId: "lead",
    contactName: "name",
    businessName: "business",
    contactEmail: "email",
    contactPhone: "phone",
  };

  Object.entries(map).forEach(([field, param]) => {
    const el = form.elements.namedItem(field) || document.getElementById(field);
    const val = params.get(param);
    if (el && val) el.value = val;
  });

  const servicesParam = params.get("services");
  if (servicesParam) {
    servicesParam.split(",").forEach((id) => {
      const box = form.querySelector(`input[name="services"][value="${id.trim()}"]`);
      if (box) box.checked = true;
    });
  }

  const getChecked = (name) =>
    [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("ob-submit");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Αποστολή…";
    }

    const fd = new FormData(form);
    const payload = {
      leadId: String(fd.get("leadId") || "").trim(),
      contactName: String(fd.get("contactName") || "").trim(),
      businessName: String(fd.get("businessName") || "").trim(),
      contactEmail: String(fd.get("contactEmail") || "").trim(),
      contactPhone: String(fd.get("contactPhone") || "").trim(),
      approver: String(fd.get("approver") || "").trim(),
      services: getChecked("services"),
      startDate: String(fd.get("startDate") || "").trim(),
      industry: String(fd.get("industry") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      website: String(fd.get("website") || "").trim(),
      businessAbout: String(fd.get("businessAbout") || "").trim(),
      audience: String(fd.get("audience") || "").trim(),
      usp: String(fd.get("usp") || "").trim(),
      competitors: String(fd.get("competitors") || "").trim(),
      tone: getChecked("tone"),
      brandColors: String(fd.get("brandColors") || "").trim(),
      language: String(fd.get("language") || "").trim(),
      brandKitUrl: String(fd.get("brandKitUrl") || "").trim(),
      taboo: String(fd.get("taboo") || "").trim(),
      ig: String(fd.get("ig") || "").trim(),
      fb: String(fd.get("fb") || "").trim(),
      tiktok: String(fd.get("tiktok") || "").trim(),
      otherSocial: String(fd.get("otherSocial") || "").trim(),
      accessMethod: String(fd.get("accessMethod") || "").trim(),
      whatWorks: String(fd.get("whatWorks") || "").trim(),
      monthFocus: String(fd.get("monthFocus") || "").trim(),
      faqs: String(fd.get("faqs") || "").trim(),
      offers: String(fd.get("offers") || "").trim(),
      mustTopics: String(fd.get("mustTopics") || "").trim(),
      avoidTopics: String(fd.get("avoidTopics") || "").trim(),
      hashtags: String(fd.get("hashtags") || "").trim(),
      geoTags: String(fd.get("geoTags") || "").trim(),
      needAvatar: String(fd.get("needAvatar") || "").trim(),
      assetsUrl: String(fd.get("assetsUrl") || "").trim(),
      appearance: String(fd.get("appearance") || "").trim(),
      shootAvailability: String(fd.get("shootAvailability") || "").trim(),
      shootLocation: String(fd.get("shootLocation") || "").trim(),
      gmbUrl: String(fd.get("gmbUrl") || "").trim(),
      gmbAccess: String(fd.get("gmbAccess") || "").trim(),
      gmbCategory: String(fd.get("gmbCategory") || "").trim(),
      gmbHours: String(fd.get("gmbHours") || "").trim(),
      gmbServices: String(fd.get("gmbServices") || "").trim(),
      approvalSpeed: String(fd.get("approvalSpeed") || "").trim(),
      commChannel: String(fd.get("commChannel") || "").trim(),
      extraNotes: String(fd.get("extraNotes") || "").trim(),
    };

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      form.classList.add("is-success");
      form.innerHTML = `
        <h2>Ευχαριστούμε!</h2>
        <p>Το onboarding της <strong>${payload.businessName}</strong> στάλθηκε στην ομάδα MyReels.<br />Θα επικοινωνήσουμε για τα επόμενα βήματα.</p>
      `;
    } catch (err) {
      console.error("[MyReels] onboarding failed:", err);
      alert(
        "Η αποστολή απέτυχε. Δοκίμασε ξανά ή στείλε μας απευθείας email. " +
          (err?.message || "")
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Υποβολή onboarding";
      }
    }
  });
})();
