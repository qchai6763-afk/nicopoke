import { handleGroupRequest } from "../lib/group-core.mjs";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

const PREFIX = "nicopoke-groups/";

function memoryStore() {
  const g = globalThis;
  if (!g.__nicopokeGroups) g.__nicopokeGroups = new Map();
  const map = g.__nicopokeGroups;
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async set(key, data) {
      map.set(key, data);
    },
  };
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.NICOPOKE_BLOB_TOKEN || "";
}

function storeIdFromToken(token) {
  const match = String(token).match(/^vercel_blob_rw_([^_]+)_/);
  return match ? match[1] : "";
}

function blobPath(key) {
  return `${PREFIX}${key}.json`;
}

function blobHeaders(token) {
  const storeId = storeIdFromToken(token);
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-api-version": "12",
  };
  if (storeId) headers["x-vercel-blob-store-id"] = storeId;
  return headers;
}

function blobStore(token) {
  const storeId = storeIdFromToken(token);
  return {
    async get(key) {
      const path = blobPath(key);
      if (storeId) {
        const publicUrl = `https://${storeId}.public.blob.vercel-storage.com/${path}`;
        const published = await fetch(publicUrl, { cache: "no-store" });
        if (published.ok) return published.json();
      }
      const res = await fetch(
        `https://blob.vercel-storage.com/?pathname=${encodeURIComponent(path)}`,
        { method: "GET", headers: blobHeaders(token), cache: "no-store" }
      );
      if (!res.ok) return null;
      const payload = await res.json().catch(() => null);
      if (payload && payload.url) {
        const file = await fetch(payload.url, { cache: "no-store" });
        if (file.ok) return file.json();
      }
      if (payload && payload.group) return payload;
      return null;
    },
    async set(key, data) {
      const path = blobPath(key);
      const res = await fetch(
        `https://blob.vercel-storage.com/?pathname=${encodeURIComponent(path)}`,
        {
          method: "PUT",
          headers: Object.assign({}, blobHeaders(token), {
            "x-vercel-blob-access": "public",
            "x-add-random-suffix": "0",
            "x-allow-overwrite": "1",
            "x-content-type": "application/json",
          }),
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`blob save failed (${res.status}): ${detail.slice(0, 300)}`);
      }
    },
  };
}

function makeStore() {
  const token = blobToken();
  return token ? blobStore(token) : memoryStore();
}

function incomingUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  return `${proto}://${host}${req.url}`;
}

function incomingHeaders(req) {
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (value == null) return;
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  return headers;
}

function incomingBody(req) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return undefined;
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body == null) return undefined;
  return JSON.stringify(req.body);
}

export default async function handler(req, res) {
  const request = new Request(incomingUrl(req), {
    method: req.method,
    headers: incomingHeaders(req),
    body: incomingBody(req),
  });
  const response = await handleGroupRequest(request, makeStore());
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.send(await response.text());
}
