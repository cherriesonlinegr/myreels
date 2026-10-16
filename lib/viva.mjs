import { randomBytes } from "node:crypto";

let cachedToken = { token: "", exp: 0 };

function payError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hosts() {
  const demo = process.env.VIVA_DEMO !== "0";
  return {
    token: demo
      ? "https://demo-accounts.vivapayments.com/connect/token"
      : "https://accounts.vivapayments.com/connect/token",
    api: demo ? "https://demo-api.vivapayments.com" : "https://api.vivapayments.com",
    checkout: demo ? "https://demo.vivapayments.com/web/checkout" : "https://www.vivapayments.com/web/checkout",
    key: demo
      ? "https://demo.vivapayments.com/api/messages/config/token"
      : "https://www.vivapayments.com/api/messages/config/token",
  };
}

function settings() {
  const clientId = String(process.env.VIVA_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.VIVA_CLIENT_SECRET || "").trim();
  const sourceCode = String(process.env.VIVA_SOURCE_CODE || "").trim();
  if (!clientId || !clientSecret || !/^\d{4}$/.test(sourceCode)) {
    throw payError("Η πληρωμή δεν είναι έτοιμη ακόμα.", 503);
  }
  return { clientId, clientSecret, sourceCode };
}

function checkoutUrl(orderCode) {
  const url = new URL(hosts().checkout);
  url.searchParams.set("ref", String(orderCode));
  url.searchParams.set("color", "FF5A5F");
  return url.toString();
}

function field(text, key) {
  const match = String(text || "").match(new RegExp(`"${key}"\\s*:\\s*("?)([^"\\n,}\\]]+)\\1`, "i"));
  return match ? match[2].trim() : "";
}

function amountMatches(reported, expectedCents) {
  const amount = Number(reported);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(expectedCents)) return false;
  if (Math.round(amount * 100) === expectedCents) return true;
  return Number.isInteger(amount) && amount === expectedCents;
}

function describe(kind, property) {
  const place = String(property || "το κατάλυμα").slice(0, 80);
  if (kind === "pack10") return `Αναβάθμιση σε 10 Reels για το ${place}`.slice(0, 250);
  if (kind === "pack5") return `Αναβάθμιση σε 5 Reels για το ${place}`.slice(0, 250);
  return `Reel για το ${place}`.slice(0, 250);
}

async function accessToken() {
  if (cachedToken.token && cachedToken.exp > Date.now() + 15000) return cachedToken.token;
  const { clientId, clientSecret } = settings();
  const response = await fetch(hosts().token, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("[myreels/viva] token", response.status);
    throw payError("Η Viva δεν δέχτηκε τη σύνδεση.", 502);
  }
  const data = JSON.parse(text);
  if (!data.access_token) throw payError("Η Viva δεν δέχτηκε τη σύνδεση.", 502);
  cachedToken = {
    token: data.access_token,
    exp: Date.now() + (Number(data.expires_in) || 300) * 1000,
  };
  return cachedToken.token;
}

async function createOrder({ amountCents, paymentId, customerTrns, email, fullName, phone }) {
  const { sourceCode } = settings();
  const token = await accessToken();
  const response = await fetch(`${hosts().api}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountCents,
      customerTrns,
      merchantTrns: paymentId,
      sourceCode,
      paymentTimeout: 1800,
      preauth: false,
      allowRecurring: false,
      customer: {
        email,
        fullName,
        phone: String(phone || "").replace(/[^\d+]/g, "").slice(0, 20),
        countryCode: "GR",
        requestLang: "el-GR",
      },
    }),
  });
  const text = await response.text();
  const orderCode = text.match(/"orderCode"\s*:\s*"?(\d+)"?/)?.[1] || "";
  if (!response.ok || !orderCode) {
    console.error("[myreels/viva] order", response.status);
    throw payError("Η πληρωμή δεν άνοιξε.", 502);
  }
  return orderCode;
}

async function retrieveTransaction(transactionId) {
  if (!/^[0-9a-f-]{32,40}$/i.test(transactionId)) throw payError("Η πληρωμή δεν επιβεβαιώθηκε.");
  const token = await accessToken();
  const response = await fetch(`${hosts().api}/checkout/v2/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("[myreels/viva] transaction", response.status);
    throw payError("Η πληρωμή δεν επιβεβαιώθηκε.", 502);
  }
  return text;
}

function judge(text, payment) {
  const statusId = field(text, "statusId").toUpperCase();
  const orderCode = field(text, "orderCode").replace(/\D/g, "");
  const merchantTrns = field(text, "merchantTrns");
  const amount = field(text, "amount");
  if (!orderCode || orderCode !== payment.orderCode) return "reject";
  if (merchantTrns && merchantTrns !== payment.id) return "reject";
  if (statusId === "F" && amountMatches(amount, payment.amountCents)) return "paid";
  if (statusId === "E" || statusId === "X") return "failed";
  return "pending";
}

async function notifyMerchant(payment) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.LEAD_NOTIFY_EMAIL;
  if (!apiKey || !from || !to || !payment) return false;
  const euros = new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(payment.amountCents / 100);
  const label = payment.kind === "pack10"
    ? "Αναβάθμιση 10 Reels"
    : payment.kind === "pack5"
      ? "Αναβάθμιση 5 Reels"
      : "Πρώτο Reel";
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    replyTo: payment.email || undefined,
    subject: `[MyReels Πληρωμή] ${payment.buyerName || "Πελάτης"} — ${payment.property} — ${euros}€`,
    text: [
      label,
      `Κατάλυμα: ${payment.property}`,
      `Όνομα: ${payment.buyerName}`,
      `Email: ${payment.email}`,
      `Τηλέφωνο: ${payment.phone || "—"}`,
      `Ποσό: ${euros}€`,
      ...(payment.document === "invoice"
        ? [
            "Παραστατικό: Τιμολόγιο",
            `ΑΦΜ: ${payment.afm}`,
            `Επωνυμία: ${payment.companyName}`,
            payment.companyTitle ? `Διακριτικός τίτλος: ${payment.companyTitle}` : "",
            payment.companyAddress ? `Διεύθυνση: ${payment.companyAddress}` : "",
          ].filter(Boolean)
        : ["Παραστατικό: Απόδειξη"]),
      `Παραγγελία Viva: ${payment.orderCode}`,
    ].join("\n"),
  });
  if (error) {
    console.error("[myreels/viva] notify", error.message || error);
    return false;
  }
  return true;
}

export async function startCheckout(input) {
  const { loadBoard, quoteStayCheckout, rememberVivaOrder } = await import("./stay-board.mjs");
  const quote = quoteStayCheckout(await loadBoard(), input);
  const { lookupAfm } = await import("./afm.mjs");
  let billing = { document: "receipt", afm: "", name: "", title: "", address: "" };
  if (input?.document === "invoice") {
    billing = { document: "invoice", ...(await lookupAfm(input.afm)) };
  }
  const sameBill = quote.reuse
    && (quote.reuse.document || "receipt") === billing.document
    && (quote.reuse.afm || "") === billing.afm;
  if (quote.reuse && sameBill) return { url: checkoutUrl(quote.reuse.orderCode) };
  const id = `mr_${randomBytes(8).toString("hex")}`;
  const orderCode = await createOrder({
    amountCents: quote.amountCents,
    paymentId: id,
    customerTrns: describe(quote.kind, quote.deal.property),
    email: quote.email,
    fullName: quote.buyerName,
    phone: quote.phone,
  });
  await rememberVivaOrder({
    id,
    orderCode,
    kind: quote.kind,
    videoId: quote.deal.videoId,
    property: quote.deal.property,
    buyerName: quote.buyerName,
    email: quote.email,
    phone: quote.phone,
    document: billing.document,
    afm: billing.afm,
    companyName: billing.name,
    companyTitle: billing.title,
    companyAddress: billing.address,
    net: quote.deal.net,
    pack5: quote.deal.pack5,
    pack10: quote.deal.pack10,
    amountCents: quote.amountCents,
    status: "pending",
    transactionId: "",
    createdAt: new Date().toISOString(),
    paidAt: "",
    notified: false,
  });
  return { url: checkoutUrl(orderCode) };
}

export async function confirmFromTransaction(orderCode, transactionId) {
  const { loadBoard, completeVivaOrder, failVivaOrder, vivaPaymentView, markVivaNotified } = await import("./stay-board.mjs");
  const code = String(orderCode || "").replace(/\D/g, "");
  const board = await loadBoard();
  const payment = board.payments.find((item) => item.orderCode === code);
  if (!payment) return null;
  if (payment.status === "paid" || !transactionId) return vivaPaymentView(board, payment);
  const text = await retrieveTransaction(transactionId);
  const verdict = judge(text, payment);
  if (verdict === "reject") return vivaPaymentView(board, payment);
  if (verdict === "failed") return vivaPaymentView(board, await failVivaOrder(code));
  if (verdict !== "paid") return vivaPaymentView(board, payment);
  const done = await completeVivaOrder({
    orderCode: code,
    transactionId,
    reportedAmount: field(text, "amount"),
    merchantTrns: field(text, "merchantTrns"),
  });
  if (!done || done.rejected) return vivaPaymentView(board, payment);
  if (!done.already && !done.payment?.notified) {
    const sent = await notifyMerchant(done.payment);
    if (sent) await markVivaNotified(code);
  }
  const saved = await loadBoard();
  return vivaPaymentView(saved, saved.payments.find((item) => item.orderCode === code) || done.payment);
}

export async function handleWebhook(raw) {
  const eventType = Number(field(raw, "EventTypeId"));
  if (eventType !== 1796 && eventType !== 1798) return;
  const merchantTrns = field(raw, "MerchantTrns");
  const transactionId = field(raw, "TransactionId");
  const orderCode = field(raw, "OrderCode").replace(/\D/g, "");
  const { loadBoard, failVivaOrder } = await import("./stay-board.mjs");
  const board = await loadBoard();
  const payment = board.payments.find((item) => item.id === merchantTrns)
    || board.payments.find((item) => item.orderCode === orderCode);
  if (!payment) return;
  if (eventType === 1798) {
    if (payment.status !== "paid") await failVivaOrder(payment.orderCode);
    return;
  }
  if (transactionId) await confirmFromTransaction(payment.orderCode, transactionId);
}

export async function webhookVerification() {
  const merchantId = String(process.env.VIVA_MERCHANT_ID || "").trim();
  const apiKey = String(process.env.VIVA_API_KEY || "").trim();
  if (!merchantId || !apiKey) throw payError("Η επαλήθευση webhook δεν είναι έτοιμη.", 503);
  const response = await fetch(hosts().key, {
    headers: { Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}` },
  });
  const text = await response.text();
  let key = text.match(/"Key"\s*:\s*"([^"]+)"/i)?.[1] || "";
  if (!key && response.ok && /^[A-Za-z0-9+/=_-]{8,200}$/.test(text.trim())) key = text.trim();
  if (!response.ok || !key) {
    console.error("[myreels/viva] webhook key", response.status);
    throw payError("Η επαλήθευση webhook δεν είναι έτοιμη.", 502);
  }
  return { Key: key };
}
