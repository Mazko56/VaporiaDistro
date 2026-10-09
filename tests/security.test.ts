import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {makeSession,readSession,validateTelegramInitData,calcDiscount,maxRedeemable} from '../server/security';
const secret='a'.repeat(64);
test('Signed sessions accept an untampered payload and reject tampering',()=>{
 const token=makeSession('123456',secret,2000);
 assert.equal(readSession(token,secret,1999),'123456');
 assert.equal(readSession(token,secret,2000),null);
 assert.equal(readSession(token.replace(/.$/,'X'),secret,1999),null);
});
test('Telegram initData HMAC validation',()=>{
 const botToken='123456:ABCtestBotToken';
 const user=JSON.stringify({id:123456,first_name:'Demo',username:'demo'});
 const payload=`auth_date=1700000000&query_id=AAE&user=${encodeURIComponent(user)}`;
 const key=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
 const check=['auth_date=1700000000','query_id=AAE',`user=${user}`].join('\n');
 const hash=crypto.createHmac('sha256',key).update(check).digest('hex');
 assert.equal(validateTelegramInitData(`${payload}&hash=${hash}`,botToken,1700000020)?.id,'123456');
 assert.equal(validateTelegramInitData(`${payload}&hash=${hash.slice(0,-1)}${hash.at(-1)==='1'?'2':'1'}`,botToken,1700000020),null);
 assert.equal(validateTelegramInitData(`${payload}&hash=${hash}`,botToken,1700090000),null);
});
test('Discounts and redemption caps never exceed cart value',()=>{
 assert.equal(calcDiscount(35000,{kind:'percent',value:5}),1750);
 assert.equal(calcDiscount(35000,{kind:'fixed',value:90000}),35000);
 assert.equal(maxRedeemable(200,10000),30);
 assert.equal(maxRedeemable(10,10000),10);
 assert.equal(maxRedeemable(10,0),0);
});
