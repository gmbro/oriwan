import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_GIFT_REWARDS,FORTUNE_MESSAGES,selectGiftReward,validateGiftRewards} from '../lib/gift-rewards.ts';
test('every possible server ticket yields exactly 90% fortunes and 10% prizes',()=>{
 const counts=new Map(); for(let i=0;i<10000;i++){const r=selectGiftReward(DEFAULT_GIFT_REWARDS,i);counts.set(r.id,(counts.get(r.id)||0)+1);}
 assert.equal(FORTUNE_MESSAGES.length,20);for(const row of DEFAULT_GIFT_REWARDS.items)assert.equal(counts.get(row.id),row.weight);
 assert.equal(DEFAULT_GIFT_REWARDS.items.filter(r=>r.kind==='fortune').reduce((n,r)=>n+counts.get(r.id),0),9000);
 assert.throws(()=>selectGiftReward(DEFAULT_GIFT_REWARDS,10000));
});
test('invalid weights, duplicate IDs and overlong prize labels cannot be persisted',()=>{
 assert.ok(validateGiftRewards(DEFAULT_GIFT_REWARDS));
 for(const change of [{weight:-1},{weight:0.5},{message:'x'.repeat(118),kind:'prize'},{id:'fortune-2'}]){
 const config={items:DEFAULT_GIFT_REWARDS.items.map((r,i)=>i===0?{...r,...change}:{...r})};assert.equal(validateGiftRewards(config),null);
 }
 const paused={items:[{id:'paused',kind:'prize',message:'중지',weight:0},{id:'live',kind:'fortune',message:'응원',weight:10000}]};assert.ok(validateGiftRewards(paused));assert.equal(selectGiftReward(paused,0).id,'live');
});
