import crypto from 'node:crypto';
export function validateTelegramInitData(initData:string, botToken:string, nowSeconds=Math.floor(Date.now()/1000)) {
  if (!botToken || !initData || initData.length > 16384) return null;
  const p=new URLSearchParams(initData), hash=p.get('hash'), auth=Number(p.get('auth_date'));
  if(!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isInteger(auth) || auth > nowSeconds+60 || nowSeconds-auth>86400) return null;
  const lines=[...p.entries()].filter(([key])=>key!=='hash' && key!=='signature').sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`);
  const secret=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
  const computed=crypto.createHmac('sha256',secret).update(lines.join('\n')).digest();
  if(!crypto.timingSafeEqual(computed,Buffer.from(hash,'hex'))) return null;
  try {
    const u=JSON.parse(p.get('user')||'null');
    if (!u || !Number.isSafeInteger(u.id) || u.id<1) return null;
    return {id:String(u.id),username:String(u.username||''),first_name:String(u.first_name||''),photo_url:String(u.photo_url||'')};
  } catch {return null;}
}
export function makeSession(id:string, secret:string, exp=Math.floor(Date.now()/1000)+7*86400) {
  const data=Buffer.from(JSON.stringify({id,exp})).toString('base64url');
  const mac=crypto.createHmac('sha256',secret).update(data).digest('base64url');
  return `${data}.${mac}`;
}
export function readSession(raw:string|undefined, secret:string, now=Math.floor(Date.now()/1000)) {
  if (!raw || !secret || raw.length>2048) return null;
  const parts=raw.split('.');if(parts.length!==2)return null;
  const mac=crypto.createHmac('sha256',secret).update(parts[0]).digest();
  let sig:Buffer; try {sig=Buffer.from(parts[1],'base64url');}catch{return null;}
  if(mac.length!==sig.length || !crypto.timingSafeEqual(mac,sig))return null;
  try{const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());return typeof p.id==='string' && /^\d+$/.test(p.id) && Number.isInteger(p.exp) && p.exp>now ? p.id:null;}catch{return null;}
}
export function calcDiscount(subtotal:number,coupon:{kind:string,value:number}|null) {
  if(!coupon)return 0;
  const discount=coupon.kind==='percent'?Math.floor(subtotal*Math.min(100,coupon.value)/100):coupon.value;
  return Math.min(subtotal,Math.max(0,discount));
}
export function maxRedeemable(balance:number, afterCouponKop:number) {
  return Math.max(0,Math.min(balance,Math.floor(afterCouponKop*0.3/100)));
}
