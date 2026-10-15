function adminDenied(body) {
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  const adminUser = process.env.ADMIN_USER || "Thereelproject";
  const adminPass = process.env.ADMIN_PASS || "reels4YOU";
  if (user === adminUser && pass === adminPass) return "";
  return "Δεν έχεις πρόσβαση.";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const body = req.body || {};
  const denied = adminDenied(body);
  if (denied) return res.status(401).json({ ok: false, error: denied });

  try {
    const { disconnectGoogle, googleAuthUrl, googleConfigured, googleRedirectUri, googleStatus } = await import(
      "../lib/google-link.mjs"
    );
    const action = String(body.action || "status");
    if (action === "status") return res.status(200).json(await googleStatus({ live: body.live === true }));
    if (action === "start") {
      if (!googleConfigured()) {
        return res.status(400).json({
          ok: false,
          error: "Λείπουν το GOOGLE_CLIENT_ID και το GOOGLE_CLIENT_SECRET από το Vercel.",
          ...(await googleStatus()),
        });
      }
      return res.status(200).json({ ok: true, url: googleAuthUrl(googleRedirectUri(req)) });
    }
    if (action === "disconnect") {
      await disconnectGoogle();
      return res.status(200).json(await googleStatus());
    }
    return res.status(400).json({ ok: false, error: "Άγνωστη ενέργεια." });
  } catch (err) {
    console.error("[myreels/google]", err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || "Η Google δεν απάντησε." });
  }
}
