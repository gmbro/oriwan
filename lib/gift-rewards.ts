export type GiftReward = { id: string; kind: "fortune" | "prize"; message: string; weight: number };
export type GiftRewardConfig = { items: GiftReward[] };
export const FORTUNE_MESSAGES = [
 "오늘은 작은 용기가 좋은 기회를 데려올 거예요. 가볍게 한 걸음 내디뎌보세요.",
 "당신이 지킨 아침의 약속이 오늘의 든든한 자신감이 됩니다.",
 "오늘은 서두르지 않아도 괜찮아요. 나만의 속도가 가장 좋은 속도예요.",
 "반가운 대화가 기다리는 하루예요. 먼저 따뜻한 인사를 건네보세요.",
 "작은 일을 끝내면 큰 힘이 생길 거예요. 오늘의 첫 성공을 만들어보세요.",
 "어제보다 가벼운 마음으로 시작해요. 오늘은 새롭게 선택할 수 있어요.",
 "꾸준히 쌓은 노력이 빛날 차례예요. 지금의 자신을 믿어주세요.",
 "오늘의 행운은 웃음에서 시작돼요. 나에게도 다정하게 웃어주세요.",
 "뜻밖의 즐거움을 발견할 수 있는 날이에요. 익숙한 길도 새롭게 바라보세요.",
 "아침을 움직인 당신에게 박수를 보내요. 이미 멋진 시작을 했어요.",
 "오늘은 마음의 여유가 좋은 판단을 도와줄 거예요. 깊게 숨을 쉬어보세요.",
 "작은 친절이 기분 좋은 하루로 돌아올 거예요. 응원을 한 번 나눠보세요.",
 "완벽하지 않아도 충분해요. 오늘 해낸 한 가지를 기억해주세요.",
 "새로운 생각이 떠오를 수 있는 하루예요. 작은 아이디어도 적어두세요.",
 "힘이 필요할 때 함께하는 사람들이 있어요. 혼자 애쓰지 않아도 괜찮아요.",
 "오늘의 한 걸음이 내일의 당신을 응원해요. 멀리보다 꾸준히 가보세요.",
 "잠깐의 휴식이 더 좋은 에너지를 줄 거예요. 몸의 이야기도 들어주세요.",
 "기분 좋은 변화는 작은 선택에서 시작돼요. 오늘 자신을 위한 선택을 해보세요.",
 "지금까지 이어온 당신의 시간을 응원해요. 오늘도 충분히 잘하고 있어요.",
 "오늘 하루의 주인공은 당신이에요. 기분 좋은 시작을 마음껏 누려보세요.",
];
export const DEFAULT_GIFT_REWARDS: GiftRewardConfig = { items: [
 ...FORTUNE_MESSAGES.map((message,i)=>({id:`fortune-${i+1}`,kind:"fortune" as const,message,weight:450})),
 {id:"crew-talent",kind:"prize",message:"스내사 크루 재능기부 1회권",weight:334},
 {id:"bonanza-coffee",kind:"prize",message:"보난자 커피 쿠폰",weight:333},
 {id:"corrective-session",kind:"prize",message:"교정운동 무료 1회권",weight:333},
] };
export function validateGiftRewards(value: unknown): GiftRewardConfig | null {
 if (!value || typeof value!=="object" || !("items" in value) || !Array.isArray(value.items) || !value.items.length || value.items.length>80) return null;
 const items: GiftReward[]=[]; const ids=new Set<string>();
 for(const row of value.items) {
  if (!row || typeof row!=="object" || typeof row.id!=="string" || !/^[a-zA-Z0-9-]{1,60}$/.test(row.id) || ids.has(row.id) || !["fortune","prize"].includes(row.kind) || typeof row.message!=="string" || !row.message.trim() || row.message.trim().length>(row.kind==="prize"?117:120) || !Number.isInteger(row.weight) || row.weight<0 || row.weight>10000) return null;
  ids.add(row.id); items.push({id:row.id,kind:row.kind,message:row.message.trim(),weight:row.weight});
 }
 return items.reduce((n,r)=>n+r.weight,0)===10000 ? {items}:null;
}
export function selectGiftReward(config: GiftRewardConfig, ticket: number) {
 if(!Number.isInteger(ticket)||ticket<0||ticket>=10000) throw new Error("Invalid reward ticket");
 let boundary=0; for(const item of config.items){boundary+=item.weight;if(ticket<boundary)return item;}
 throw new Error("Invalid reward weights");
}
