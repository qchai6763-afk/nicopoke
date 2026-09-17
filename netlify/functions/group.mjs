import { getStore } from "@netlify/blobs";
import { handleGroupRequest } from "../../lib/group-core.mjs";

const STORE_NAME = "nicopoke-groups";

function netlifyStore(store) {
  return {
    async get(key) {
      let data = await store.get(key, { type: "json" });
      if (!data) data = await store.get(key, { type: "text" });
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
      return data || null;
    },
    async set(key, data) {
      data.group.code = key;
      await store.setJSON(key, data);
    },
  };
}

export default async (request) => {
  let adapter = null;
  try {
    adapter = netlifyStore(
      getStore({
        name: STORE_NAME,
        consistency: "strong",
      })
    );
  } catch {
    adapter = null;
  }
  return handleGroupRequest(request, adapter);
};
