function back(res, query) {
  res.writeHead(302, { Location: `/admin?${query}`, "Cache-Control": "no-store" });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const error = String(req.query.error || "");
  if (error) {
    const message = error === "access_denied" ? "Ακύρωσες τη σύνδεση." : "Η Google δεν ολοκλήρωσε τη σύνδεση.";
    return back(res, `google=error&reason=${encodeURIComponent(message)}`);
  }

  try {
    const { connectGoogle, readState } = await import("../lib/google-link.mjs");
    const state = readState(req.query.state);
    if (!state) return back(res, `google=error&reason=${encodeURIComponent("Η σύνδεση έληξε. Ξαναπροσπάθησε.")}`);
    await connectGoogle(String(req.query.code || ""), state.redirectUri);
    return back(res, "google=connected");
  } catch (err) {
    console.error("[myreels/google] oauth", err?.message || err);
    const message = String(err?.message || "Η σύνδεση δεν ολοκληρώθηκε.").slice(0, 180);
    return back(res, `google=error&reason=${encodeURIComponent(message)}`);
  }
}
