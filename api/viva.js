export const config = {
  api: {
    bodyParser: false,
  },
};

async function rawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const part = String(req.query?.part || "");
  if (part === "checkout" || part === "orders" || part === "stripe") {
    const routes = await import("../lib/stripe-routes.mjs");
    if (part === "stripe") {
      const payload = await rawBody(req);
      return routes.handleStripeWebhook(req, res, payload);
    }
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      const raw = await rawBody(req);
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
    }
    if (part === "orders") return routes.handleOrders(req, res);
    return routes.handleCheckout(req, res);
  }
  try {
    const viva = await import("../lib/viva.mjs");
    if (req.method === "GET") {
      const orderCode = String(req.query?.s || req.query?.order || "");
      if (orderCode) {
        const view = await viva.confirmFromTransaction(orderCode, String(req.query?.t || ""));
        if (!view) return res.status(404).json({ ok: false, error: "Αυτή η πληρωμή δεν βρέθηκε." });
        return res.status(200).json({ ok: true, ...view });
      }
      const key = await viva.webhookVerification();
      return res.status(200).json(key);
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const raw = await rawBody(req);
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
    if (body.action === "afm") {
      const { lookupAfm } = await import("../lib/afm.mjs");
      const company = await lookupAfm(body.afm);
      return res.status(200).json({ ok: true, ...company });
    }
    if (body.action === "checkout") {
      const result = await viva.startCheckout(body);
      return res.status(200).json({ ok: true, url: result.url });
    }
    await viva.handleWebhook(raw);
    return res.status(200).json({ ok: true });
  } catch (err) {
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error("[myreels/viva]", err?.message || err);
    return res.status(status).json({ ok: false, error: err?.message || "Η πληρωμή δεν ολοκληρώθηκε." });
  }
}
