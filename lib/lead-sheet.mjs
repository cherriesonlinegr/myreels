import crypto from "node:crypto";

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SHEET_ID !== "1JLWqWL81F1u4t6ffRz7D8abSDxLgcAQHSkiI_j_Ir2M"
    ? process.env.GOOGLE_SHEET_ID
    : "1XkTya3NbH1GVNwqxJfRYtjk1AxoAgElEt-dz4fKkNk4";
const SHEET_TAB = "Φύλλο1";
const COL = {
  order: 1,
  status: 2,
  link: 3,
  name: 4,
  region: 5,
  email: 6,
  phone: 7,
  social: 8,
  channel: 9,
  contacted: 10,
  replied: 11,
  notes: 12,
  buyerName: 14,
  buyerPhone: 15,
  buyerEmail: 16,
};
const WIDTH = 17;

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

function exactName(left, right) {
  return clean(left).replace(/\s+/g, " ") === clean(right).replace(/\s+/g, " ");
}

function plainPhone(value) {
  const phone = clean(value);
  return phone === "#ERROR!" ? "" : phone;
}

function athensStamp() {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(",", "");
}

function appendLog(notes, line) {
  const current = clean(notes);
  if (!line || current.endsWith(line)) return current;
  const next = current ? `${current}\n${line}` : line;
  if (next.length <= 8000) return next;
  const parts = next.split("\n");
  while (parts.join("\n").length > 8000 && parts.length > 1) parts.shift();
  return parts.join("\n");
}

function logLine(action, detail) {
  const extra = clean(detail).slice(0, 300);
  return `${athensStamp()} · ${action}${extra ? ` · ${extra}` : ""}`;
}

export function movesFromLeadNotes(leads) {
  return (Array.isArray(leads) ? leads : []).flatMap((lead) => movesFromNotes(lead.name, lead.notes));
}

function movesFromNotes(name, notes) {
  return String(notes || "")
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?\s+·\s+([^·]+?)(?:\s+·\s+(.*))?$/);
      if (!match) return null;
      return {
        date: `${match[1]}${match[2] ? ` ${match[2]}` : ""}`,
        name,
        move: match[3].trim(),
        detail: clean(match[4]),
      };
    })
    .filter(Boolean);
}

function leadFromRow(cells, row) {
  const line = pad(cells, WIDTH);
  return {
    row,
    order: clean(line[COL.order]),
    status: clean(line[COL.status]),
    link: clean(line[COL.link]),
    name: clean(line[COL.name]),
    region: clean(line[COL.region]),
    email: clean(line[COL.email]),
    phone: plainPhone(line[COL.phone]),
    social: clean(line[COL.social]),
    channel: clean(line[COL.channel]),
    contacted: clean(line[COL.contacted]),
    replied: clean(line[COL.replied]),
    notes: clean(line[COL.notes]),
    buyerName: clean(line[COL.buyerName]),
    buyerPhone: plainPhone(line[COL.buyerPhone]),
    buyerEmail: clean(line[COL.buyerEmail]),
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
  const leadRows = account ? await getValues(`${SHEET_TAB}!A1:Q800`) : await readCsv(SHEET_TAB);
  const leads = leadRows
    .slice(1)
    .map((cells, index) => leadFromRow(cells, index + 2))
    .filter((lead) => lead.name);
  const moves = leads.flatMap((lead) => movesFromNotes(lead.name, lead.notes));
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
  const values = await getValues(`${SHEET_TAB}!A1:Q800`);
  const leads = values.slice(1).map((cells, index) => leadFromRow(cells, index + 2));
  const existing = leads.find((lead) => lead.name && exactName(lead.name, name));
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
    const row = pad([], WIDTH);
    row[COL.order] = order;
    row[COL.status] = "Στην ουρά";
    row[COL.link] = incoming.link;
    row[COL.name] = name;
    row[COL.region] = incoming.region;
    row[COL.email] = incoming.email;
    row[COL.phone] = incoming.phone;
    row[COL.social] = incoming.social;
    row[COL.channel] = incoming.channel;
    row[COL.notes] = appendLog(incoming.notes, logLine("Μπήκε στην ουρά", ""));
    await appendValues(`${SHEET_TAB}!A:Q`, row);
    return { ok: true };
  }
  const row = pad(values[existing.row - 1], WIDTH);
  const fill = (index, value) => {
    if (value) row[index] = value;
  };
  fill(COL.link, incoming.link);
  row[COL.name] = name;
  fill(COL.region, incoming.region);
  fill(COL.email, incoming.email);
  fill(COL.phone, incoming.phone);
  fill(COL.social, incoming.social);
  fill(COL.channel, incoming.channel);
  if (incoming.notes) row[COL.notes] = appendLog(row[COL.notes], incoming.notes);
  const currentRank = STATUS_RANK[clean(row[COL.status])] || 0;
  if (currentRank < STATUS_RANK["Στην ουρά"]) {
    row[COL.status] = "Στην ουρά";
    if (!clean(row[COL.order])) row[COL.order] = nextOrder(leads);
    row[COL.notes] = appendLog(row[COL.notes], logLine("Μπήκε στην ουρά", ""));
  }
  await updateValues(`${SHEET_TAB}!A${existing.row}:Q${existing.row}`, row);
  return { ok: true };
}

function statusFor(current, action) {
  if (action === "Δημιουργήθηκε landing") {
    return current === "" || current === "Νέο" || current === "Στην ουρά" ? "Landing" : "";
  }
  const status = MOVE_STATUS[action];
  if (!status) return "";
  if ((STATUS_RANK[status] || 0) > (STATUS_RANK[current] || 0)) return status;
  return "";
}

function rememberBuyer(row, input, overwrite) {
  const pairs = [
    [COL.buyerName, input?.buyerName],
    [COL.buyerPhone, input?.buyerPhone],
    [COL.buyerEmail, input?.buyerEmail],
  ];
  for (const [index, value] of pairs) {
    const next = clean(value);
    if (!next || next === "#ERROR!") continue;
    if (overwrite || !clean(row[index]) || clean(row[index]) === "#ERROR!") row[index] = next;
  }
}

export async function logMovement({ property, move, detail, buyerName, buyerPhone, buyerEmail }) {
  const name = clean(property);
  const action = clean(move);
  if (name.length < 2 || !action) return { skipped: true };
  if (!serviceAccount()) return { skipped: true, error: "Το Sheet δεν είναι συνδεδεμένο για εγγραφή." };
  const values = await getValues(`${SHEET_TAB}!A1:Q800`);
  const matches = [];
  for (let index = 1; index < values.length; index += 1) {
    if (exactName(values[index][COL.name], name)) matches.push(index);
  }
  if (!matches.length) return { ok: false, error: "Δεν υπάρχει στο Sheet με αυτό ακριβώς το όνομα." };
  const line = logLine(action, detail);
  const buyer = { buyerName, buyerPhone, buyerEmail };
  const overwrite = action === "Στοιχεία πελάτη" || action.startsWith("Αγόρασε");
  let status = "";
  let notes = "";
  for (const index of matches) {
    const row = pad(values[index], WIDTH);
    const next = statusFor(clean(row[COL.status]), action);
    if (next) {
      row[COL.status] = next;
      status = next;
    }
    if (action === "Στάλθηκε μήνυμα") row[COL.contacted] = athensDate();
    row[COL.notes] = appendLog(row[COL.notes], line);
    notes = row[COL.notes];
    rememberBuyer(row, buyer, overwrite);
    await updateValues(`${SHEET_TAB}!A${index + 1}:Q${index + 1}`, row);
  }
  return { ok: true, name, status, notes };
}
