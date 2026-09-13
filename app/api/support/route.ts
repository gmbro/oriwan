import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin-data";
import { privateUploadStore } from "@/lib/member-upload-server";
import { resolvePersonalKakaoIdentity } from "@/lib/personal-member-context";
import { guardMutationRequest, guardReadRequest } from "@/lib/request-security";
import { nextSupportDate } from "@/lib/support-cooldown";
export const dynamic = "force-dynamic";
const cookieName = "twtt-support-visitor";
async function handle(request: NextRequest, complete: boolean) {
  const options = { requireSameOrigin:true, rateLimit:{key:"support-status",limit:30,windowMs:60_000,message:"잠시 후 다시 확인해주세요."} };
  const blocked = complete ? guardMutationRequest(request, options) : guardReadRequest(request, options);
  if (blocked) return blocked;
  try {
    const identity = await resolvePersonalKakaoIdentity();
    const raw = request.cookies.get(cookieName)?.value;
    const visitor = raw && /^[0-9a-f-]{36}$/.test(raw) ? raw : randomUUID();
    const key = identity.ok ? `user-${identity.authUserId}` : `guest-${visitor}`;
    const service = getServiceClient();
    if (!service) throw new Error("unavailable");
    const store = await privateUploadStore(service);
    const path = `support-cooldowns/${key}.json`;
    const result = await store.download(path);
    let nextAt: string | null = null;
    if (result.error) {
      const error=result.error as {statusCode?:string|number;message?:string};
      if (String(error.statusCode)!=="404" && !/not found|does not exist/i.test(error.message||"")) throw new Error("read failed");
    } else {
      const saved=JSON.parse(await result.data.text());
      if (typeof saved.nextAt!=="string" || !Number.isFinite(Date.parse(saved.nextAt))) throw new Error("invalid state");
      nextAt=saved.nextAt;
    }
    const now=new Date();
    if (complete && (!nextAt || Date.parse(nextAt)<=now.getTime())) {
      nextAt=nextSupportDate(now);
      // Self-reported completion only: this is not bank or gift payment verification.
      const saved=await store.upload(path,JSON.stringify({nextAt,reportedAt:now.toISOString()}),{upsert:true,contentType:"application/json"});
      if(saved.error)throw new Error("write failed");
    }
    const response=NextResponse.json({nextAt,locked:!!nextAt&&Date.parse(nextAt)>now.getTime()}, {headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
    if(!identity.ok)response.cookies.set(cookieName,visitor,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:366*86400});
    return response;
  } catch {return NextResponse.json({error:"후원 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export async function GET(request:NextRequest){return handle(request,false);}
export async function POST(request:NextRequest){return handle(request,true);}
