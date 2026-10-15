function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function validAfm(value) {
  const afm = String(value || "").replace(/\D/g, "");
  if (!/^\d{9}$/.test(afm) || afm === "000000000") return false;
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += Number(afm[i]) * 2 ** (8 - i);
  return (sum % 11) % 10 === Number(afm[8]);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function company(afm, name, title, address) {
  const legal = clean(name);
  if (!legal || legal === "---") throw fail("Δεν βρέθηκαν στοιχεία για αυτό το ΑΦΜ.");
  const commercial = clean(title);
  const place = clean(address);
  return {
    afm,
    name: legal.slice(0, 200),
    title: commercial && commercial !== "---" ? commercial.slice(0, 120) : "",
    address: place && place !== "---" ? place.slice(0, 300) : "",
  };
}

async function lookupVies(afm) {
  let response;
  try {
    response = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/EL/vat/${afm}`, {
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw fail("Η αναζήτηση ΑΦΜ δεν απάντησε. Δοκίμασε ξανά.", 502);
  }
  if (!response.ok) throw fail("Η αναζήτηση ΑΦΜ δεν απάντησε. Δοκίμασε ξανά.", 502);
  const data = await response.json().catch(() => ({}));
  if (data.isValid !== true) throw fail("Δεν βρέθηκαν στοιχεία για αυτό το ΑΦΜ.");
  const [legal, title] = String(data.name || "").split("||");
  return company(afm, legal, title, data.address);
}

function xml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tag(source, name) {
  const match = String(source || "").match(new RegExp(`<[^>]*:?${name}>([^<]*)</[^>]*:?${name}>`, "i"));
  return match ? match[1] : "";
}

async function lookupAade(afm) {
  const username = process.env.AADE_USERNAME;
  const password = process.env.AADE_PASSWORD;
  const caller = String(process.env.AADE_AFM || "").replace(/\D/g, "");
  const today = new Date().toISOString().slice(0, 10);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:ns1="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:ns2="http://rgwspublic2/RgWsPublic2Service" xmlns:ns3="http://rgwspublic2/RgWsPublic2">
  <env:Header>
    <ns1:Security>
      <ns1:UsernameToken>
        <ns1:Username>${xml(username)}</ns1:Username>
        <ns1:Password>${xml(password)}</ns1:Password>
      </ns1:UsernameToken>
    </ns1:Security>
  </env:Header>
  <env:Body>
    <ns2:rgWsPublic2AfmMethod>
      <ns2:INPUT_REC>
        <ns3:afm_called_by>${xml(caller)}</ns3:afm_called_by>
        <ns3:afm_called_for>${xml(afm)}</ns3:afm_called_for>
        <ns3:as_on_date>${today}</ns3:as_on_date>
      </ns2:INPUT_REC>
    </ns2:rgWsPublic2AfmMethod>
  </env:Body>
</env:Envelope>`;
  let response;
  try {
    response = await fetch("https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2", {
      method: "POST",
      headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
      body,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw fail("Η αναζήτηση ΑΦΜ δεν απάντησε. Δοκίμασε ξανά.", 502);
  }
  const text = await response.text();
  const errorText = clean(tag(text, "error_descr"));
  if (!response.ok || errorText) throw fail(errorText || "Δεν βρέθηκαν στοιχεία για αυτό το ΑΦΜ.");
  const inactive = tag(text, "deactivation_flag") === "1" && /απενεργ/i.test(tag(text, "deactivation_flag_descr"));
  if (inactive) throw fail("Αυτό το ΑΦΜ δεν είναι ενεργό.");
  const address = [tag(text, "postal_address"), tag(text, "postal_address_no"), tag(text, "postal_zip_code"), tag(text, "postal_area_description")]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  return company(afm, tag(text, "onomasia"), tag(text, "commer_title"), address);
}

export async function lookupAfm(value) {
  const afm = String(value || "").replace(/\D/g, "");
  if (!validAfm(afm)) throw fail("Το ΑΦΜ δεν είναι σωστό.");
  const caller = String(process.env.AADE_AFM || "").replace(/\D/g, "");
  if (process.env.AADE_USERNAME && process.env.AADE_PASSWORD && validAfm(caller)) {
    return lookupAade(afm);
  }
  return lookupVies(afm);
}
