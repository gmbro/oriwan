import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { privateUploadStore } from "@/lib/member-upload-server";
import { DEFAULT_GIFT_REWARDS, validateGiftRewards } from "@/lib/gift-rewards";
export async function loadGiftRewards(service: SupabaseClient, adminId: string) {
 const store=await privateUploadStore(service);
 const result=await store.download(`gift-config/4th/${adminId}.json`);
 if(result.error){
  const e=result.error as {statusCode?:string|number;message?:string};
  if(String(e.statusCode)==="404" || /not found|does not exist/i.test(e.message||""))return DEFAULT_GIFT_REWARDS;
  throw new Error("Gift configuration unavailable");
 }
 const config=validateGiftRewards(JSON.parse(await result.data.text()));
 if(!config)throw new Error("Invalid gift configuration");
 return config;
}
