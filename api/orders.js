import { stripeClient, orderFromSession, productLabel, euroLabel } from "../lib/payments.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedUser = process.env.ADMIN_USER || "";
  const expectedPass = process.env.ADMIN_PASS || "";
  const body = req.body || {};
  const isStay = String(body.user || "") === "Nakis" && String(body.pass || "") === "Terminator";
  const isAdmin =
    expectedUser &&
    expectedPass &&
    String(body.user || "") === expectedUser &&
    String(body.pass || "") === expectedPass;
  if (!isAdmin && !isStay) {
    if (!expectedUser || !expectedPass) {
      return res.status(500).json({
        ok: false,
        error: "Βάλε ADMIN_USER και ADMIN_PASS στο Vercel, ίδια με την είσοδο του admin.",
      });
    }
    return res.status(401).json({ ok: false, error: "Δεν έχεις πρόσβαση στις πληρωμές." });
  }

  const stripe = stripeClient();
  if (!stripe) {
    return res.status(500).json({ ok: false, error: "Λείπει το STRIPE_SECRET_KEY στο Vercel." });
  }

  try {
    const page = await stripe.checkout.sessions.list({ limit: 40 });
    const orders = page.data
      .filter((session) => session.payment_status === "paid")
      .map((session) => {
        const order = orderFromSession(session);
        return {
          ...order,
          label: productLabel(order),
          amountLabel: euroLabel(order.amount),
        };
      });
    return res.status(200).json({ ok: true, orders });
  } catch (err) {
    console.error("[myreels/orders] list failed:", err);
    return res.status(502).json({ ok: false, error: "Οι πληρωμές δεν διαβάστηκαν από το Stripe." });
  }
}
