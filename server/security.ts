import crypto from 'node:crypto';
export type TelegramAuthFailure = 'missing_data' | 'invalid_format' | 'expired' | 'future_date' | 'signature_mismatch' | 'invalid_user';
export type TelegramUser = {id:string;username:string;first_name:string;photo_url:string};

// Official production Ed25519 key published by Telegram for third-party Mini App validation.
// https://core.telegram.org/bots/webapps#validating-data-for-third-party-use
const TELEGRAM_PUBLIC_KEY = crypto.createPublicKey({
  key: Buffer.concat([
    Buffer.from('302a300506032b6570032100','hex'), // DER SPKI prefix for Ed25519
    Buffer.from('e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d','hex')
  ]),
  format:'der',type:'spki'
});

function dataCheckString(params:URLSearchParams) {
  return [...params.entries()]
    .filter(([key])=>key!=='hash' && key!=='signature')
    .sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)
    .map(([key,value])=>`${key}=${value}`).join('\n');
}

// This is cryptographic validation, not a fallback that bypasses Telegram authentication.
// Telegram signs the same initData with Ed25519 (signature), independently of the bot-token HMAC.
// The bot ID from BOT_TOKEN must be included in the signed message so other bots cannot impersonate ours.
function validTelegramEd25519Signature(params:URLSearchParams,botToken:string,checkString:string) {
  const botId = /^(\d+):/.exec(botToken)?.[1];
  const signature = params.get('signature');
  if(!botId || params.getAll('signature').length!==1 || !signature || !/^[A-Za-z0-9_-]{86}={0,2}$/.test(signature))return false;
  try {
    const sig=Buffer.from(signature,'base64url');
    if(sig.length!==64)return false;
    return crypto.verify(null,Buffer.from(`${botId}:WebAppData\n${checkString}`,'utf8'),TELEGRAM_PUBLIC_KEY,sig);
  }catch{return false;}
}

export function inspectTelegramInitData(initData:string, botToken:string, nowSeconds=Math.floor(Date.now()/1000)):
  {user:TelegramUser;reason:null}|{user:null;reason:TelegramAuthFailure} {
  if (!botToken || !initData || initData.length > 16384)return {user:null,reason:'missing_data'};
  const p=new URLSearchParams(initData);
  const hash=p.get('hash'), auth=Number(p.get('auth_date'));
  if(p.getAll('hash').length!==1 || p.getAll('auth_date').length!==1 || !hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isInteger(auth) || auth<=0)
    return {user:null,reason:'invalid_format'};
  if(auth>nowSeconds+60)return {user:null,reason:'future_date'};
  if(nowSeconds-auth>86400)return {user:null,reason:'expired'};
  if(p.getAll('user').length!==1)return {user:null,reason:'invalid_user'};
  const checkString=dataCheckString(p);
  const secret=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
  const computed=crypto.createHmac('sha256',secret).update(checkString).digest();
  const hmacValid=crypto.timingSafeEqual(computed,Buffer.from(hash,'hex'));
  // An official Telegram Ed25519 signature is equally authoritative for this exact bot ID.
  // This also handles clients where the bot-token HMAC verification does not match.
  if(!hmacValid && !validTelegramEd25519Signature(p,botToken,checkString))
    return {user:null,reason:'signature_mismatch'};
  try {
    const u=JSON.parse(p.get('user')||'null');
    if(!u || !Number.isSafeInteger(u.id) || u.id<1)return {user:null,reason:'invalid_user'};
    return {user:{id:String(u.id),username:String(u.username||''),first_name:String(u.first_name||''),photo_url:String(u.photo_url||'')},reason:null};
  } catch {return {user:null,reason:'invalid_user'};}
}
export function validateTelegramInitData(initData:string, botToken:string, nowSeconds=Math.floor(Date.now()/1000)) {
  return inspectTelegramInitData(initData,botToken,nowSeconds).user;
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
