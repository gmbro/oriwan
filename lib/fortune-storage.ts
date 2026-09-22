import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { privateUploadStore } from "@/lib/member-upload-server";

// Service-only private storage, scoped to the verified account, never a browser-supplied ID.
export async function fortuneStorage(service: SupabaseClient, userId: string) {
  const store = await privateUploadStore(service);
  const prefix = `fortune/${userId}`;
  return {
    async read(key: string): Promise<unknown> {
      const { data, error } = await store.download(`${prefix}/${key}.json`);
      if (error) {
        if (String(error.statusCode) === "404" || /not found|does not exist/i.test(error.message)) return null;
        throw error;
      }
      return data ? JSON.parse(await data.text()) : null;
    },
    async write(key: string, value: unknown) {
      const { error } = await store.upload(`${prefix}/${key}.json`, JSON.stringify(value), { contentType: "application/json", upsert: true });
      if (error) throw error;
    },
  };
}
