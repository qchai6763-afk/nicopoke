const { getStore } = require("@netlify/blobs");

function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function normalizeCode(raw) {
  return String(raw || "")
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-ー＿_]/g, "")
    .toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headers() };
  }

  const code = normalizeCode(event.queryStringParameters?.code);
  if (!/^[A-Z2-9]{4,8}$/.test(code)) {
    return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "bad code" }) };
  }

  let store;
  try {
    store = getStore("nicopoke-groups");
  } catch {
    return { statusCode: 501, headers: headers(), body: JSON.stringify({ error: "store unavailable" }) };
  }

  if (event.httpMethod === "GET") {
    const data = await store.get(code, { type: "json" });
    if (!data) {
      return { statusCode: 404, headers: headers(), body: JSON.stringify({ error: "not found" }) };
    }
    return { statusCode: 200, headers: headers(), body: JSON.stringify(data) };
  }

  if (event.httpMethod === "PUT") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "bad json" }) };
    }
    await store.setJSON(code, payload);
    return { statusCode: 200, headers: headers(), body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: headers(), body: JSON.stringify({ error: "method" }) };
};
