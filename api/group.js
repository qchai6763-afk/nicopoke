import { handleGroupRequest } from "../lib/group-core.mjs";

export const config = { runtime: "edge" };

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

function blobPath(key) {
  return `${PREFIX}${key}.json`;
}

function blobStore(token) {
  return {
    async get(key) {
      const { head } = await import("@vercel/blob");
      try {
        const meta = await head(blobPath(key), { token });
        const res = await fetch(meta.url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    async set(key, data) {
      const { put } = await import("@vercel/blob");
      await put(blobPath(key), JSON.stringify(data), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json",
        token,
      });
    },
  };
}

function makeStore() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.NICOPOKE_BLOB_TOKEN;
  if (token) return blobStore(token);
  return memoryStore();
}

export default async function handler(request) {
  return handleGroupRequest(request, makeStore());
}
