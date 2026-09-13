import { NextRequest, NextResponse } from "next/server";
import { requireAdminDataAccess } from "@/lib/admin-data-access";
import { guardMutationRequest, readLimitedJson } from "@/lib/request-security";
import { loadGiftRewards } from "@/lib/gift-rewards-server";
import { validateGiftRewards } from "@/lib/gift-rewards";
import { privateUploadStore } from "@/lib/member-upload-server";
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
export async function GET(){
 const access=await requireAdminDataAccess();if(!access.ok)return access.response;
 try{
 const [config, claims]=await Promise.all([loadGiftRewards(access.service,access.user.id),access.service.from("daily_gift_claims").select("id, participant_id, record_date, message, participants(name)").eq("season_key","4th").eq("user_id",access.user.id).like("message","🎁 %").order("claimed_at",{ascending:false}).limit(100)]);
 return json({config,claims:claims.data||[],claimsError:claims.error?"당첨 내역을 불러오지 못했어요.":null});
 }catch{return json({error:"보상 설정을 불러오지 못했어요."},503);}
}
export async function PUT(request:NextRequest){
 const guard=guardMutationRequest(request,{maxBodyBytes:32768});if(guard)return guard;
 const access=await requireAdminDataAccess();if(!access.ok)return access.response;
 const body=await readLimitedJson(request,32768);if(!body.ok)return body.response;
 const config=validateGiftRewards(body.value);if(!config)return json({error:"문구는 1~120자, 확률 합계는 100%여야 해요."},400);
 try{
  const store=await privateUploadStore(access.service);
  const saved=await store.upload(`gift-config/4th/${access.user.id}.json`,JSON.stringify(config),{contentType:"application/json",upsert:true});
  if(saved.error)throw saved.error;
  return json({config});
 }catch{return json({error:"보상 설정을 저장하지 못했어요."},503);}
}
