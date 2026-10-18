import {
  stripeClient,
  parseNet,
  grossOf,
  eurosToCents,
  cleanText,
  euroLabel,
  requestOrigin,
  safeReturnPath,
  notifyPaidOnce,
  orderFromSession,
  productLabel,
} from "./payments.js";

function cleanPhone(value) {
  const raw = cleanText(value, 20);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  return raw;
}

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export async function handleCheckout(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const stripe = stripeClient();
  if (!stripe) {
    return json(res, 500, {
      ok: false,
      error: "Λείπει το STRIPE_SECRET_KEY στο Vercel.",
    });
  }

  if (req.method === "GET") return readSession(req, res, stripe);
  if (req.method === "POST") return createSession(req, res, stripe);
  return json(res, 405, { ok: false, error: "Method not allowed" });
}

async function readSession(req, res, stripe) {
  const id = cleanText(req.query?.session_id, 120);
  if (!id.startsWith("cs_")) {
    return json(res, 400, { ok: false, error: "Λείπει η πληρωμή." });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    if (session.payment_status !== "paid") {
      return json(res, 402, { ok: false, error: "Η πληρωμή δεν έχει ολοκληρωθεί." });
    }
    await notifyPaidOnce(stripe, session);
    const order = orderFromSession(session);
    return json(res, 200, { ok: true, order });
  } catch (err) {
    console.error("[myreels/checkout] read failed:", err);
    return json(res, 404, { ok: false, error: "Δεν βρέθηκε η πληρωμή." });
  }
}

async function createSession(req, res, stripe) {
  const body = req.body || {};
  const origin = requestOrigin(req);
  if (!origin) return json(res, 400, { ok: false, error: "Λείπει το site." });

  const kind = body.kind === "pack" ? "pack" : "reel";
  try {
    if (kind === "reel") return json(res, 200, await reelSession(stripe, origin, body));
    return json(res, 200, await packSession(stripe, origin, body));
  } catch (err) {
    console.error("[myreels/checkout] create failed:", err);
    return json(res, 400, { ok: false, error: err?.message || "Η πληρωμή δεν άνοιξε." });
  }
}

async function reelSession(stripe, origin, body) {
  const buyerName = cleanText(body.buyerName, 80);
  const property = cleanText(body.property, 80);
  const email = cleanText(body.email, 120).toLowerCase();
  const phone = cleanPhone(body.phone);
  const videoId = cleanText(body.videoId, 20);
  const net = parseNet(body.net);
  const pack5 = parseNet(body.pack5);
  const pack10 = parseNet(body.pack10);
  if (buyerName.length < 2) throw new Error("Γράψε ονοματεπώνυμο.");
  if (property.length < 2) throw new Error("Γράψε το όνομα του καταλύματος.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Γράψε ένα έγκυρο email.");
  if (!phone) throw new Error("Γράψε ένα τηλέφωνο.");
  if (net == null) throw new Error("Η τιμή δεν είναι έγκυρη.");
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error("Λείπει το βίντεο.");

  const gross = grossOf(net);
  const driveId = cleanText(body.driveId, 80);
  const cancel = safeReturnPath(body.cancelPath, `/reel?v=${videoId}`);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "el",
    customer_email: email,
    client_reference_id: videoId,
    success_url: `${origin}/upsell?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancel}`,
    metadata: {
      kind: "reel",
      buyerName,
      property,
      email,
      phone,
      videoId,
      driveId: /^[\w-]{10,80}$/.test(driveId) ? driveId : "",
      net: String(net),
      p5: pack5 == null ? "" : String(pack5),
      p10: pack10 == null ? "" : String(pack10),
    },
    payment_intent_data: {
      description: `1 Reel — ${property}`,
      metadata: { kind: "reel", buyerName, property, email, phone },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: eurosToCents(gross),
          product_data: {
            name: `Reel — ${property}`,
            description: `${euroLabel(net)} + ΦΠΑ 24%. Σύνολο ${euroLabel(gross)}.`,
          },
        },
      },
    ],
  });
  return { ok: true, url: session.url };
}

async function packSession(stripe, origin, body) {
  const paidId = cleanText(body.sessionId, 120);
  const pack = Number(body.pack);
  if (!paidId.startsWith("cs_")) throw new Error("Πλήρωσε πρώτα το πρώτο Reel.");
  if (pack !== 5 && pack !== 10) throw new Error("Διάλεξε 5 ή 10 Reels.");

  const first = await stripe.checkout.sessions.retrieve(paidId);
  if (first.payment_status !== "paid" || first.metadata?.kind !== "reel") {
    throw new Error("Η πληρωμή του πρώτου Reel δεν έχει ολοκληρωθεί.");
  }
  const meta = first.metadata || {};
  if (meta.upgraded === "5" || meta.upgraded === "10") {
    throw new Error("Η παραγγελία έχει ήδη αναβαθμιστεί.");
  }
  const paidNet = parseNet(meta.net);
  const packNet = parseNet(pack === 5 ? meta.p5 : meta.p10);
  if (paidNet == null || packNet == null) throw new Error("Λείπει η τιμή του πακέτου.");
  const extraNet = Math.round((packNet - paidNet) * 100) / 100;
  const extraGross = Math.round((grossOf(packNet) - grossOf(paidNet)) * 100) / 100;
  if (extraNet <= 0 || extraGross <= 0) throw new Error("Η αναβάθμιση δεν είναι διαθέσιμη.");
  const property = cleanText(meta.property, 80);
  const buyerName = cleanText(meta.buyerName, 80);
  const email = cleanText(meta.email, 120).toLowerCase();
  const phone = cleanPhone(meta.phone);
  const videoId = cleanText(meta.videoId, 20);
  const scheduling = pack === 10;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      locale: "el",
      customer_email: email,
      client_reference_id: paidId,
      success_url: `${origin}/upsell?done={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upsell?paid=${encodeURIComponent(paidId)}&step=${pack}&cancelled=1`,
      metadata: {
        kind: "pack",
        pack: String(pack),
        buyerName,
        property,
        email,
        phone,
        videoId,
        net: String(packNet),
        paidNet: String(paidNet),
        extraNet: String(extraNet),
        scheduling: scheduling ? "2m" : "",
        reelSession: paidId,
      },
      payment_intent_data: {
        description: scheduling
          ? `Αναβάθμιση σε 10 Reels + διαχείριση social 2 μηνών — ${property}`
          : `Αναβάθμιση σε 5 Reels — ${property}`,
        metadata: {
          kind: "pack",
          pack: String(pack),
          buyerName,
          property,
          email,
          phone,
          scheduling: scheduling ? "2m" : "",
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: eurosToCents(extraGross),
            product_data: {
              name: scheduling
                ? `Αναβάθμιση σε 10 Reels — ${property}`
                : `Αναβάθμιση σε 5 Reels — ${property}`,
              description: scheduling
                ? `Διαφορά ${euroLabel(extraNet)} + ΦΠΑ. Σύνολο πακέτου ${euroLabel(packNet)} + ΦΠΑ. Έχει ήδη πληρωθεί ${euroLabel(paidNet)} + ΦΠΑ. Διαχείριση social για 2 μήνες, posts, hashtags, μία ανάρτηση κάθε 2–3 μέρες.`
                : `Διαφορά ${euroLabel(extraNet)} + ΦΠΑ. Σύνολο πακέτου ${euroLabel(packNet)} + ΦΠΑ. Έχει ήδη πληρωθεί ${euroLabel(paidNet)} + ΦΠΑ. Χωρίς scheduling.`,
            },
          },
        },
      ],
    },
    { idempotencyKey: `upgrade-${paidId}-${pack}` }
  );
  return { ok: true, url: session.url };
}

export async function handleOrders(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedUser = process.env.ADMIN_USER || "";
  const expectedPass = process.env.ADMIN_PASS || "";
  const body = req.body || {};
  const isAdmin =
    expectedUser &&
    expectedPass &&
    String(body.user || "") === expectedUser &&
    String(body.pass || "") === expectedPass;
  if (!isAdmin) {
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

export async function handleStripeWebhook(req, res, payload) {
  if (req.method !== "POST") return res.status(405).end();
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(500).end();

  let event;
  try {
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
