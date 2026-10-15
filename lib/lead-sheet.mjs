import crypto from "node:crypto";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1JLWqWL81F1u4t6ffRz7D8abSDxLgcAQHSkiI_j_Ir2M";

const STATUS_RANK = {
  Όχι: 0,
  "": 0,
  Νέο: 1,
  "Στην ουρά": 2,
  Στάλθηκε: 3,
  "Follow-up": 4,
  Απάντησε: 5,
  Landing: 6,
  "Αγόρασε 1 Reel": 7,
  "Αγόρασε 5": 8,
  "Αγόρασε 10": 9,
};

const MOVE_STATUS = {
  "Μπήκε στην ουρά": "Στην ουρά",
  "Στάλθηκε μήνυμα": "Στάλθηκε",
  "Follow-up": "Follow-up",
  Απάντησε: "Απάντησε",
  "Δημιουργήθηκε landing": "Landing",
  "Αγόρασε 1 Reel": "Αγόρασε 1 Reel",
  "Αγόρασε 5 Reels": "Αγόρασε 5",
  "Αγόρασε 10 Reels": "Αγόρασε 10",
  Αρνήθηκε: "Όχι",
};

let tokenCache = { token: "", exp: 0 };

function clean(value) {
  return String(value || "").trim();
}

function sameName(left, right) {
  return clean(left).toLocaleLowerCase("el") === clean(right).toLocaleLowerCase("el");
}

function pad(cells, size) {
  const row = Array.isArray(cells) ? cells.slice(0, size) : [];
  while (row.length < size) row.push("");
  return row.map((cell) => (cell == null ? "" : cell));
}

function serviceAccount() {
  const raw = clean(process.env.GOOGLE_SERVICE_ACCOUNT);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    parsed.private_key = String(parsed.private_key).replace(/\\n/g, "\n");
    return parsed;
  } catch {
    return null;
  }
}

function sheetError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function athensDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("day")}/${pick("month")}/${pick("year")}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function leadFromRow(cells, row) {
  const line = pad(cells, 12);
  return {
    row,
    order: clean(line[0]),
    status: clean(line[1]),
    link: clean(line[2]),
    name: clean(line[3]),
    region: clean(line[4]),
    email: clean(line[5]),
    phone: clean(line[6]),
    social: clean(line[7]),
    channel: clean(line[8]),
    contacted: clean(line[9]),
    replied: clean(line[10]),
    notes: clean(line[11]),
  };
}

function moveFromRow(cells) {
  const line = pad(cells, 4);
  return {
    date: clean(line[0]),
    name: clean(line[1]),
    move: clean(line[2]),
    detail: clean(line[3]),
  };
}

let gidCache = null;

async function sheetGid(sheetName) {
  if (!gidCache) {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`);
    const html = await response.text();
    gidCache = {};
    for (const match of html.matchAll(/name: "([^"]+)", pageUrl:.*?gid: "(\d+)"/g)) {
      gidCache[match[1]] = match[2];
    }
  }
  const gid = gidCache[sheetName];
  if (!gid) throw sheetError(`Δεν βρέθηκε η καρτέλα «${sheetName}».`);
  return gid;
}

async function readCsv(sheetName) {
  const gid = await sheetGid(sheetName);
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`);
  const text = await response.text();
  if (!response.ok || text.trim().startsWith("<")) {
    throw sheetError("Το Google Sheet δεν διαβάζεται.");
  }
  return parseCsv(text);
}

async function accessToken() {
  const account = serviceAccount();
  if (!account) throw sheetError("Λείπει ο λογαριασμός του Google Sheet.", 503);
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.exp > now + 60) return tokenCache.token;
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${claim}`);
  sign.end();
  const signature = sign.sign(account.private_key).toString("base64url");
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claim}.${signature}`,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  if (!data.access_token) throw sheetError("Ο λογαριασμός του Google Sheet δεν συνδέθηκε.", 503);
  tokenCache = { token: data.access_token, exp: now + 3600 };
  return data.access_token;
}

async function sheets(path, { method = "GET", body } = {}) {
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      const email = serviceAccount()?.client_email || "τον λογαριασμό του site";
      throw sheetError(`Το Sheet δεν είναι μοιρασμένο με ${email} ως Επεξεργαστή.`, 403);
    }
    throw sheetError("Το Google Sheet δεν ενημερώθηκε.");
  }
  return data;
}

async function getValues(range) {
  const data = await sheets(`/values/${encodeURIComponent(range)}`);
  return data.values || [];
}

async function appendValues(range, row) {
  await sheets(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: { values: [row] },
  });
}

async function updateValues(range, row) {
  await sheets(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: { values: [row] },
  });
}

function nextOrder(leads) {
  const numbers = leads
    .map((lead) => Number(String(lead.order || "").replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

export async function listLeads() {
  const account = serviceAccount();
  const leadRows = account ? await getValues("Επαφές!A1:L500") : await readCsv("Επαφές");
  let moveRows = [];
  try {
    moveRows = account ? await getValues("Κινήσεις!A1:D500") : await readCsv("Κινήσεις");
  } catch {
    moveRows = [];
  }
  const leads = leadRows
    .slice(1)
    .map((cells, index) => leadFromRow(cells, index + 2))
    .filter((lead) => lead.name);
  const moves = moveRows
    .slice(1)
    .map((cells) => moveFromRow(cells))
    .filter((item) => item.name && item.move);
  return {
    leads,
    moves,
    canWrite: Boolean(account),
    writer: account?.client_email || "",
  };
}

export async function saveLead(input) {
  if (!serviceAccount()) {
    throw sheetError(
      "Η επαφή φαίνεται στο dashboard, αλλά για να γραφτεί στο Sheet πρέπει να το μοιραστείς με τον λογαριασμό του site.",
      503
    );
  }
  const name = clean(input.name);
  if (name.length < 2) throw sheetError("Γράψε το όνομα του καταλύματος.", 400);
  const values = await getValues("Επαφές!A1:L500");
  const leads = values.slice(1).map((cells, index) => leadFromRow(cells, index + 2));
  const existing = leads.find((lead) => lead.name && sameName(lead.name, name));
  const incoming = {
    link: clean(input.link),
    region: clean(input.region),
    email: clean(input.email),
    phone: clean(input.phone),
    social: clean(input.social),
    channel: clean(input.channel),
    notes: clean(input.notes),
  };
  if (!existing) {
    const order = nextOrder(leads);
    await appendValues("Επαφές!A:L", [
      order,
      "Στην ουρά",
      incoming.link,
      name,
      incoming.region,
      incoming.email,
      incoming.phone,
      incoming.social,
      incoming.channel,
      "",
      "",
      incoming.notes,
    ]);
    await appendValues("Κινήσεις!A:D", [athensDate(), name, "Μπήκε στην ουρά", ""]);
    return { ok: true };
  }
  const row = pad(values[existing.row - 1], 12);
  const fill = (index, value) => {
    if (value) row[index] = value;
  };
  fill(2, incoming.link);
  row[3] = name;
  fill(4, incoming.region);
  fill(5, incoming.email);
  fill(6, incoming.phone);
  fill(7, incoming.social);
  fill(8, incoming.channel);
  fill(11, incoming.notes);
  const currentRank = STATUS_RANK[clean(row[1])] || 0;
  if (currentRank < STATUS_RANK["Στην ουρά"]) {
    row[1] = "Στην ουρά";
    if (!clean(row[0])) row[0] = nextOrder(leads);
    await appendValues("Κινήσεις!A:D", [athensDate(), name, "Μπήκε στην ουρά", ""]);
  }
  await updateValues(`Επαφές!A${existing.row}:L${existing.row}`, row);
  return { ok: true };
}

export async function logMovement({ property, move, detail }) {
  const name = clean(property);
  const action = clean(move);
  if (name.length < 2 || !action) return { skipped: true };
  if (!serviceAccount()) return { skipped: true };
  await appendValues("Κινήσεις!A:D", [athensDate(), name, action, clean(detail).slice(0, 500)]);
  const nextStatus = MOVE_STATUS[action];
  if (!nextStatus) return { ok: true };
  const values = await getValues("Επαφές!A1:L500");
  for (let index = 1; index < values.length; index += 1) {
    if (!sameName(values[index][3], name)) continue;
    const current = clean(values[index][1]);
    if ((STATUS_RANK[nextStatus] || 0) > (STATUS_RANK[current] || 0)) {
      await updateValues(`Επαφές!B${index + 1}`, [nextStatus]);
    }
    break;
  }
  return { ok: true };
}
