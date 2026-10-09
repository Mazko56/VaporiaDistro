import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {makeSession,readSession,validateTelegramInitData,inspectTelegramInitData,calcDiscount,maxRedeemable} from '../server/security';
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

test('Telegram initData explains wrong bot token and stale launches without logging secrets',()=>{
 const token='111111:AAdummyToken';
 const user=JSON.stringify({id:123456,first_name:'Alice'});
 const data=['auth_date=1700000000',`user=${user}`].join('\n');
 const key=crypto.createHmac('sha256','WebAppData').update(token).digest();
 const hash=crypto.createHmac('sha256',key).update(data).digest('hex');
 const init=`auth_date=1700000000&user=${encodeURIComponent(user)}&hash=${hash}`;
 assert.equal(inspectTelegramInitData(init,token,1700000001).user?.id,'123456');
 assert.equal(inspectTelegramInitData(init,'222222:wrongBot',1700000001).reason,'signature_mismatch');
 assert.equal(inspectTelegramInitData(init,token,1700086401).reason,'expired');
});

test('Telegram official Ed25519 signature verifies when bot-token HMAC does not match',()=>{
 // Telegram Mini Apps documented production public-key test vector.
 // https://docs.telegram-mini-apps.com/platform/init-data
 const init='user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D&chat_instance=8134722200314281151&chat_type=private&auth_date=1733584787&hash=2174df5b000556d044f3f020384e879c8efcab55ddea2ced4eb752e93e7080d6&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ';
 const rightBot='7342037359:AAThisTokenIsNotNeededForPublicSignature';
 assert.equal(inspectTelegramInitData(init,rightBot,1733584790).user?.id,'279058397');
 assert.equal(inspectTelegramInitData(init,'99999999:AAWrongBot',1733584790).reason,'signature_mismatch');
 assert.equal(inspectTelegramInitData(init.replace('279058397','279058398'),rightBot,1733584790).reason,'signature_mismatch');
 assert.equal(inspectTelegramInitData(init,rightBot,1733680000).reason,'expired');
 assert.equal(inspectTelegramInitData(init.replace('zL-ucj','xL-ucj'),rightBot,1733584790).reason,'signature_mismatch');
});
