import { stripeClient, notifyPaidOnce } from "../lib/payments.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(500).end();

  let event;
  try {
    const payload = await rawBody(req);
    event = stripe.webhooks.constructEvent(payload, req.headers["stripe-signature"], secret);
  } catch (err) {
    console.error("[myreels/webhook] signature:", err?.message);
    return res.status(400).end();
  }

  if (event.type === "checkout.session.completed") {
    try {
      await notifyPaidOnce(stripe, event.data.object);
    } catch (err) {
      console.error("[myreels/webhook] notify:", err);
      return res.status(500).end();
    }
  }
  return res.status(200).json({ received: true });
}
