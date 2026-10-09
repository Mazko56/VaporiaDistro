import express,{type Request,type Response,type NextFunction} from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import {z,ZodError} from 'zod';
import path from 'node:path';
import crypto from 'node:crypto';
import {config,validateConfig} from './config';
import {pool,query,tx} from './db';
import {seed} from './seed';
import {migrate} from './migrate';
import {inspectTelegramInitData,makeSession,readSession,calcDiscount,maxRedeemable} from './security';
import {initBot,handleTelegramUpdate,notifyOrder,notifyStatus} from './bot';
import {canTransitionOrder,earnedBonusPoints,shouldAwardOrder,type OrderStatus} from './orderLifecycle';
import {uaPhoneSchema} from './validation';

class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use(express.json({limit:'128kb'}));
app.use(cookieParser());
const wrap=(f:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(f(req,res)).catch(next);};
const validate=<T extends z.ZodTypeAny>(schema:T,body:unknown):z.infer<T>=>schema.parse(body);
const getUser=(res:Response)=>res.locals.user as any;
const userGuard=(req:Request,res:Response,next:NextFunction)=>{
  (async()=>{
    const id=readSession(req.cookies.vaporia_session,config.sessionSecret);
    if(!id)throw new HttpError(401,'Відкрийте Mini App через Telegram');
    const users=await query('SELECT * FROM users WHERE telegram_id=$1',[id]);
    if(!users.length)throw new HttpError(401,'Повторіть авторизацію');
    res.locals.user=users[0];next();
  })().catch(next);
};
const patchGuard=(req:Request,res:Response,next:NextFunction)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method) && req.path!=='/telegram/webhook' && req.get('X-Vaporia-App')!=='1')
    return next(new HttpError(403,'Запит не дозволено'));
  next();
};
app.get('/api/health',wrap(async(_req,res)=>{await pool.query('SELECT 1');res.json({ok:true,service:'vaporia-distro'});}));
app.post('/api/telegram/webhook',wrap(async(req,res)=>{
  if(!config.botToken || !config.webhookSecret || req.get('X-Telegram-Bot-Api-Secret-Token')!==config.webhookSecret)throw new HttpError(403,'Forbidden');
  await handleTelegramUpdate(req.body);res.json({ok:true});
}));
app.use('/api',patchGuard);
// Files are uploaded as image bytes and saved in PostgreSQL so Railway redeploys do not erase them.
app.get('/api/media/:id',wrap(async(req,res)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) throw new HttpError(404,'Фото не знайдено');
  const asset=(await query('SELECT mime_type,content FROM media_assets WHERE id=$1',[req.params.id]))[0];
  if(!asset)throw new HttpError(404,'Фото не знайдено');
  res.set('Content-Type',asset.mime_type);
  res.set('Cache-Control','public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options','nosniff');
  res.send(asset.content);
}));

app.get('/api/config',(_req,res)=>res.json({brand:process.env.STORE_NAME || 'VAPORIA DISTRO',bonusPercent:config.bonusPercent,devAuth:config.devAuth,checkoutEnabled:config.checkoutEnabled}));
const authLimiter=rateLimit({windowMs:60_000,limit:20,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/api/auth/telegram',authLimiter,wrap(async(req,res)=>{
  const input=validate(z.object({initData:z.string().min(1).max(16384)}),req.body);
  const check=inspectTelegramInitData(input.initData,config.botToken);
  if(!check.user){
    // Never log initData, its hash, users' personal information or the bot token.
    console.warn(`Telegram Mini App authorization rejected: ${check.reason}; ed25519_signature_present=${new URLSearchParams(input.initData).has('signature')}`);
    const message=check.reason==='expired' ? 'Дані Telegram застаріли. Закрийте Mini App та відкрийте з бота знову.' :
      check.reason==='signature_mismatch' ? 'Не вдалося підтвердити підпис Telegram. Повністю закрийте Mini App та відкрийте його через @vaporiadistro_bot.' :
      'Помилка перевірки Telegram. Закрийте Mini App та повторно відкрийте з бота.';
    throw new HttpError(401,message);
  }
  const tg=check.user;
  const roles=config.adminIds.has(tg.id)?'admin':'customer';
  await pool.query(`INSERT INTO users(telegram_id,username,first_name,photo_url,role) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,photo_url=EXCLUDED.photo_url,role=EXCLUDED.role`,
    [tg.id,tg.username,tg.first_name,tg.photo_url,roles]);
  res.cookie('vaporia_session',makeSession(tg.id,config.sessionSecret),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:7*86400*1000,path:'/'});
  res.json({ok:true});
}));
app.post('/api/auth/dev',authLimiter,wrap(async(_req,res)=>{
  if(!config.devAuth)throw new HttpError(404,'Not found');
  await pool.query(`INSERT INTO users(telegram_id,username,first_name,role,age_confirmed) VALUES(999000111,'demo','Демо-клієнт','admin',true)
    ON CONFLICT(telegram_id) DO UPDATE SET first_name=EXCLUDED.first_name,age_confirmed=true`);
  // Only local preview ID bypasses adminIds check via optional dev-only override below.
  res.cookie('vaporia_session',makeSession('999000111',config.sessionSecret),{httpOnly:true,secure:false,sameSite:'lax',maxAge:7*86400*1000,path:'/'});
  res.json({ok:true});
}));
app.post('/api/auth/logout',(_req,res)=>{res.clearCookie('vaporia_session',{path:'/'});res.json({ok:true});});
app.get('/api/me',userGuard,(req,res)=>{const u=getUser(res);res.json({id:u.id,telegram_id:u.telegram_id,username:u.username,first_name:u.first_name,photo_url:u.photo_url,age_confirmed:u.age_confirmed,age_verified:u.age_verified,bonus_balance:u.bonus_balance,role:config.adminIds.has(String(u.telegram_id)) || (config.devAuth && String(u.telegram_id)==='999000111')?'admin':'customer'});});
app.post('/api/me/confirm-age',userGuard,wrap(async(_req,res)=>{
  await pool.query('UPDATE users SET age_confirmed=true WHERE id=$1',[getUser(res).id]);res.json({ok:true});
}));
const catalogProduct=`SELECT p.*,c.name AS category_name,c.slug AS category_slug,
  COALESCE((SELECT json_agg(json_build_object('id',v.id,'label',v.label,'sku',v.sku,'stock',v.stock,'price_override',v.price_override,'is_active',v.is_active) ORDER BY v.id) FROM variants v WHERE v.product_id=p.id AND v.is_active), '[]'::json) AS variants
  FROM products p JOIN categories c ON p.category_id=c.id`;
app.get('/api/categories',wrap(async(_req,res)=>res.json(await query('SELECT * FROM categories WHERE is_active=true ORDER BY sort_order,id'))));
app.get('/api/brands',wrap(async(_req,res)=>res.json(await query('SELECT * FROM brands WHERE is_active=true ORDER BY sort_order,id'))));
app.get('/api/banners',wrap(async(_req,res)=>{res.set('Cache-Control','no-store, max-age=0');res.json(await query('SELECT * FROM banners WHERE is_active=true ORDER BY sort_order,id'));}));
app.get('/api/products',wrap(async(req,res)=>{
  const category=typeof req.query.category==='string'?req.query.category.slice(0,80):'';
  const search=typeof req.query.search==='string'?req.query.search.slice(0,90):'';
  const brand=typeof req.query.brand==='string'?req.query.brand.slice(0,100):'';
  const params:any[]=[]; let where=' WHERE p.is_active=true AND c.is_active=true';
  if(category){params.push(category);where+=` AND c.slug=$${params.length}`;}
  if(search){params.push(`%${search}%`);where+=` AND (p.name ILIKE $${params.length} OR p.brand ILIKE $${params.length} OR p.subtitle ILIKE $${params.length})`;}
  if(brand){params.push(brand);where+=` AND REPLACE(LOWER(TRIM(p.brand)),' ','')=REPLACE(LOWER(TRIM($${params.length})),' ','')`;}
  res.json(await query(`${catalogProduct}${where} ORDER BY p.created_at DESC,p.id DESC LIMIT 100`,params));
}));
app.get('/api/products/:slug',wrap(async(req,res)=>{
  const p=await query(`${catalogProduct} WHERE p.slug=$1 AND p.is_active=true AND c.is_active=true`,[req.params.slug]);
  if(!p.length)throw new HttpError(404,'Товар не знайдено');res.json(p[0]);
}));
app.get('/api/me/favorites',userGuard,wrap(async(_req,res)=>{
  res.json(await query(`${catalogProduct} JOIN favorites f ON f.product_id=p.id WHERE f.user_id=$1 AND p.is_active=true ORDER BY p.id DESC`,[getUser(res).id]));
}));
app.post('/api/me/favorites/:productId',userGuard,wrap(async(req,res)=>{
  const pid=Number(req.params.productId);if(!Number.isInteger(pid))throw new HttpError(400,'Неправильний товар');
  const u=getUser(res);const rows=await query('DELETE FROM favorites WHERE user_id=$1 AND product_id=$2 RETURNING product_id',[u.id,pid]);
  if(!rows.length)await pool.query('INSERT INTO favorites(user_id,product_id) SELECT $1,id FROM products WHERE id=$2 AND is_active=true ON CONFLICT DO NOTHING',[u.id,pid]);
  res.json({favorite:rows.length===0});
}));
const cartSql=`SELECT ci.id,ci.quantity,v.id AS variant_id,v.label AS variant_label,v.stock,v.is_active AS variant_active,
 p.id AS product_id,p.slug,p.name,p.image_url,p.base_price,p.compare_at_price,p.badge,p.is_active AS product_active,
 COALESCE(v.price_override,p.base_price) AS unit_price
 FROM cart_items ci JOIN variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id WHERE ci.user_id=$1 ORDER BY ci.id`;
app.get('/api/cart',userGuard,wrap(async(_req,res)=>{
  const items=await query(cartSql,[getUser(res).id]);res.json({items,subtotal:items.reduce((s,i)=>s+i.unit_price*i.quantity,0)});
}));
app.post('/api/cart',userGuard,wrap(async(req,res)=>{
  const input=validate(z.object({variant_id:z.number().int().positive(),quantity:z.number().int().min(1).max(99).default(1)}),req.body);
  const variant=(await query('SELECT v.stock,v.is_active,p.is_active AS product_active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1',[input.variant_id]))[0];
  if(!variant || !variant.is_active || !variant.product_active)throw new HttpError(404,'Варіант недоступний');
  if(variant.stock<input.quantity)throw new HttpError(409,'Недостатньо товару');
  const updated=await query(`INSERT INTO cart_items(user_id,variant_id,quantity) VALUES($1,$2,$3)
    ON CONFLICT(user_id,variant_id) DO UPDATE SET quantity=cart_items.quantity+EXCLUDED.quantity
    WHERE cart_items.quantity+EXCLUDED.quantity<=LEAST(99,$4)
    RETURNING quantity`,[getUser(res).id,input.variant_id,input.quantity,variant.stock]);
  if(!updated.length)throw new HttpError(409,'Недостатньо товару для цієї кількості');
  res.json({ok:true});
}));
app.patch('/api/cart/:id',userGuard,wrap(async(req,res)=>{
  const input=validate(z.object({quantity:z.number().int().min(0).max(99)}),req.body);
  if(input.quantity===0)await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2',[req.params.id,getUser(res).id]);
  else {
    const result=await query(`UPDATE cart_items ci SET quantity=$1 FROM variants v WHERE ci.id=$2 AND ci.user_id=$3 AND v.id=ci.variant_id AND v.stock>=$1 RETURNING ci.id`,[input.quantity,req.params.id,getUser(res).id]);
    if(!result.length)throw new HttpError(409,'Перевірте наявність товару');
  }
  res.json({ok:true});
}));
app.delete('/api/cart/:id',userGuard,wrap(async(req,res)=>{await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2',[req.params.id,getUser(res).id]);res.json({ok:true});}));
app.post('/api/coupon/check',userGuard,wrap(async(req,res)=>{
  const input=validate(z.object({code:z.string().trim().min(1).max(32),subtotal:z.number().int().min(0)}),req.body);
  const c=(await query(`SELECT * FROM coupons WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at>now()) AND (max_uses IS NULL OR uses<max_uses)`,[input.code.toUpperCase()]))[0];
  if(!c||input.subtotal<c.min_subtotal)throw new HttpError(400,'Промокод недійсний або не виконана мінімальна сума');
  res.json({code:c.code,discount:calcDiscount(input.subtotal,c)});
}));
const checkoutSchema=z.object({request_id:z.string().uuid(),first_name:z.string().trim().min(2).max(55),last_name:z.string().trim().min(2).max(55),phone:uaPhoneSchema,delivery_method:z.enum(['nova_poshta','ukrposhta','pickup']),city:z.string().trim().min(2).max(100),shipping_details:z.string().trim().min(1).max(200),payment_method:z.literal('cod'),comment:z.string().trim().max(800).default(''),coupon_code:z.string().trim().max(32).optional().default(''),bonus_used:z.number().int().nonnegative().default(0),age_agreed:z.literal(true)});
app.post('/api/checkout',userGuard,rateLimit({windowMs:60_000,limit:8}),wrap(async(req,res)=>{
  if(!config.checkoutEnabled)throw new HttpError(403,'Оформлення вимкнено до перевірки законодавчих вимог та підтвердження віку');
  const data=validate(checkoutSchema,req.body);const user=getUser(res);
  if (['nova_poshta','ukrposhta'].includes(data.delivery_method) && !data.shipping_details.trim())
    throw new HttpError(400,'Вкажіть номер відділення або адресу доставки');
  const existing=await query('SELECT id,number,total FROM orders WHERE request_id=$1 AND user_id=$2',[data.request_id,user.id]);
  if(existing.length){res.json({ok:true,order:existing[0]});return;}
  const order=await tx(async c=>{
    const current=(await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
    if(!current.age_confirmed)throw new HttpError(403,'Підтвердьте повноліття');
    if(config.requireVerifiedAge && !current.age_verified)throw new HttpError(403,'Перед оформленням замовлення потрібно підтвердити вік у продавця.');
    const again=(await c.query('SELECT id,number,total FROM orders WHERE request_id=$1 AND user_id=$2',[data.request_id,user.id])).rows;
    if(again.length)return again[0];
    const lines=(await c.query(`SELECT ci.quantity,v.id AS variant_id,v.label,v.sku,v.stock,v.is_active,p.name,p.base_price,p.is_active AS product_active,
      COALESCE(v.price_override,p.base_price) AS unit_price
      FROM cart_items ci JOIN variants v ON ci.variant_id=v.id JOIN products p ON v.product_id=p.id
      WHERE ci.user_id=$1 ORDER BY v.id FOR UPDATE OF v`,[user.id])).rows;
    if(!lines.length)throw new HttpError(400,'Кошик порожній');
    for(const item of lines)if(!item.is_active || !item.product_active || item.stock<item.quantity)throw new HttpError(409,`Недостатня кількість: ${item.name} (${item.label})`);
    const subtotal=lines.reduce((sum,l)=>sum+l.unit_price*l.quantity,0);
    let cpn:any=null,discount=0;
    if(data.coupon_code){
      cpn=(await c.query('SELECT * FROM coupons WHERE code=$1 FOR UPDATE',[data.coupon_code.toUpperCase()])).rows[0];
      if(!cpn||!cpn.is_active || (cpn.expires_at && new Date(cpn.expires_at)<new Date()) || (cpn.max_uses!==null && cpn.uses>=cpn.max_uses) || subtotal<cpn.min_subtotal)
        throw new HttpError(400,'Промокод більше не діє');
      discount=calcDiscount(subtotal,cpn);
    }
    if(data.bonus_used>maxRedeemable(current.bonus_balance,subtotal-discount))throw new HttpError(400,'Недостатньо бонусів або перевищено ліміт 30%');
    const total=subtotal-discount-data.bonus_used*100;
    const values=[user.id,data.request_id,`${data.first_name} ${data.last_name}`,data.phone,data.delivery_method,data.city,data.shipping_details,data.payment_method,data.comment,subtotal,discount,data.bonus_used,total,cpn?.code||null];
    const inserted=(await c.query(`INSERT INTO orders(user_id,request_id,customer_name,phone,delivery_method,city,shipping_details,payment_method,comment,subtotal,discount,bonus_used,total,coupon_code)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,number,total`,values)).rows[0];
    for(const l of lines){
      const update=await c.query('UPDATE variants SET stock=stock-$1 WHERE id=$2 AND stock>=$1 RETURNING id',[l.quantity,l.variant_id]);
      if(!update.rowCount)throw new HttpError(409,'Товар закінчився під час оформлення');
      await c.query('INSERT INTO order_items(order_id,variant_id,product_name,variant_label,sku,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[inserted.id,l.variant_id,l.name,l.label,l.sku,l.quantity,l.unit_price,l.unit_price*l.quantity]);
    }
    if(cpn)await c.query('UPDATE coupons SET uses=uses+1 WHERE id=$1',[cpn.id]);
    if(data.bonus_used){await c.query('UPDATE users SET bonus_balance=bonus_balance-$1 WHERE id=$2',[data.bonus_used,user.id]);await c.query('INSERT INTO bonus_ledger(user_id,order_id,delta,description) VALUES($1,$2,$3,$4)',[user.id,inserted.id,-data.bonus_used,'Оплата бонусами']);}
    await c.query('DELETE FROM cart_items WHERE user_id=$1',[user.id]);
    return inserted;
  });
  res.status(201).json({ok:true,order});
  void notifyOrder(String(order.number),String(user.telegram_id),Number(order.total),{deliveryMethod:data.delivery_method,city:data.city,branch:data.shipping_details,paymentMethod:data.payment_method,bonusUsed:data.bonus_used});
}));
app.get('/api/me/orders',userGuard,wrap(async(_req,res)=>{
  const orders=await query(`SELECT o.*,COALESCE((SELECT json_agg(json_build_object('product_name',oi.product_name,'variant_label',oi.variant_label,'quantity',oi.quantity,'unit_price',oi.unit_price) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id=o.id),'[]'::json) AS items
  FROM orders o WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 60`,[getUser(res).id]);res.json(orders);
}));
app.get('/api/me/bonuses',userGuard,wrap(async(_req,res)=>res.json(await query('SELECT id,delta,description,created_at FROM bonus_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[getUser(res).id]))));
// --- ADMIN ---

const adminOnly=[userGuard,(req:Request,res:Response,next:NextFunction)=>{
  if(config.adminIds.has(String(getUser(res).telegram_id)) || (config.devAuth && String(getUser(res).telegram_id)==='999000111'))next();
  else next(new HttpError(403,'Доступ заборонено'));
}];
// Uploaded image content is checked by MIME + file signature, not client filename.
const mediaParser=express.raw({type:['image/png','image/jpeg','image/webp'],limit:'4mb'});
app.post('/api/admin/media',adminOnly,mediaParser,wrap(async(req,res)=>{
  const mime=(req.get('content-type')||'').split(';')[0].trim().toLowerCase();
  const body=req.body as Buffer;
  if(!Buffer.isBuffer(body)||body.length<24||body.length>4*1024*1024)throw new HttpError(400,'Фото: лише PNG, JPG, WEBP до 4 МБ');
  const png=mime==='image/png' && body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=mime==='image/jpeg' && body[0]===255 && body[1]===216 && body[2]===255;
  const webp=mime==='image/webp' && body.toString('ascii',0,4)==='RIFF' && body.toString('ascii',8,12)==='WEBP';
  if(!png&&!jpeg&&!webp)throw new HttpError(400,'Невірний формат зображення');
  const item=(await query('INSERT INTO media_assets(mime_type,content) VALUES($1,$2) RETURNING id',[mime,body]))[0];
  res.status(201).json({url:`/api/media/${item.id}`});
}));
const brandSchema=z.object({slug:z.string().regex(/^[a-z0-9-]+$/).min(2).max(100),name:z.string().trim().min(2).max(100),image_url:z.string().max(600).default(''),sort_order:z.number().int().default(0),is_active:z.boolean().default(true)});
app.get('/api/admin/brands',adminOnly,wrap(async(_req,res)=>res.json(await query('SELECT * FROM brands ORDER BY sort_order,id'))));
app.post('/api/admin/brands',adminOnly,wrap(async(req,res)=>{
  const b=validate(brandSchema,req.body);
  res.status(201).json((await query('INSERT INTO brands(slug,name,image_url,sort_order,is_active) VALUES($1,$2,$3,$4,$5) RETURNING *',Object.values(b)))[0]);
}));
app.patch('/api/admin/brands/:id',adminOnly,wrap(async(req,res)=>{
  const b=validate(brandSchema,req.body);
  const result=await query('UPDATE brands SET slug=$1,name=$2,image_url=$3,sort_order=$4,is_active=$5 WHERE id=$6 RETURNING *',[...Object.values(b),req.params.id]);
  if(!result.length)throw new HttpError(404,'Виробника не знайдено');
  res.json(result[0]);
}));
app.get('/api/admin/overview',adminOnly,wrap(async(_req,res)=>{
  const r=await query(`SELECT (SELECT count(*) FROM orders)::int AS orders,
  (SELECT count(*) FROM orders WHERE status='pending')::int AS pending,
  (SELECT count(*) FROM products WHERE is_active)::int AS products,
  (SELECT count(*) FROM users)::int AS customers,
  (SELECT COALESCE(sum(total),0) FROM orders WHERE status IN ('completed','received'))::int AS revenue`);
  res.json(r[0]);
}));
app.get('/api/admin/orders',adminOnly,wrap(async(req,res)=>{
  const status=typeof req.query.status==='string'?req.query.status:'';
  const params:any[]=[],where=status && ['pending','confirmed','shipped','completed','received','cancelled'].includes(status)?' WHERE o.status=$1':'';
  if(where)params.push(status);
  res.json(await query(`SELECT o.*,u.telegram_id,u.username,
   COALESCE((SELECT json_agg(json_build_object('product_name',i.product_name,'variant_label',i.variant_label,'quantity',i.quantity,'line_total',i.line_total) ORDER BY i.id) FROM order_items i WHERE i.order_id=o.id),'[]'::json) AS items
   FROM orders o JOIN users u ON u.id=o.user_id ${where} ORDER BY o.created_at DESC LIMIT 200`,params));
}));
app.patch('/api/admin/orders/:id/status',adminOnly,wrap(async(req,res)=>{
  const {status}=validate(z.object({status:z.enum(['pending','confirmed','shipped','received','cancelled'])}),req.body);
  const result=await tx(async c=>{
    const old=(await c.query('SELECT o.*,u.telegram_id FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1 FOR UPDATE OF o',[req.params.id])).rows[0];
    if(!old)throw new HttpError(404,'Замовлення не знайдено');
    if(old.status===status)return old;
    if(!canTransitionOrder(old.status as OrderStatus,status))throw new HttpError(400,'Неможливий перехід статусу');
    if(status==='cancelled'){
      const items=(await c.query('SELECT * FROM order_items WHERE order_id=$1',[old.id])).rows;
      for(const i of items)if(i.variant_id)await c.query('UPDATE variants SET stock=stock+$1 WHERE id=$2',[i.quantity,i.variant_id]);
      if(old.bonus_used){await c.query('UPDATE users SET bonus_balance=bonus_balance+$1 WHERE id=$2',[old.bonus_used,old.user_id]);await c.query('INSERT INTO bonus_ledger(user_id,order_id,delta,description) VALUES($1,$2,$3,$4)',[old.user_id,old.id,old.bonus_used,'Повернення бонусів при скасуванні']);}
      if(old.coupon_code)await c.query('UPDATE coupons SET uses=GREATEST(0,uses-1) WHERE code=$1',[old.coupon_code]);
    }
    let awarded=0;
    if(shouldAwardOrder(old.status as OrderStatus,status,Number(old.bonus_awarded))){
      awarded=earnedBonusPoints(Number(old.total),config.bonusPercent);
      if(awarded>0){await c.query('UPDATE users SET bonus_balance=bonus_balance+$1 WHERE id=$2',[awarded,old.user_id]);await c.query('INSERT INTO bonus_ledger(user_id,order_id,delta,description) VALUES($1,$2,$3,$4)',[old.user_id,old.id,awarded,`Бонуси за отримане замовлення №${old.number}`]);}
    }
    const updated=(await c.query('UPDATE orders SET status=$1,bonus_awarded=$2,updated_at=now() WHERE id=$3 RETURNING *',[status,awarded,old.id])).rows[0];
    return {...updated,telegram_id:old.telegram_id};
  });
  res.json(result);void notifyStatus(String(result.telegram_id),String(result.number),status,Number(result.bonus_awarded||0));
}));
app.get('/api/admin/categories',adminOnly,wrap(async(_req,res)=>res.json(await query('SELECT * FROM categories ORDER BY sort_order,id'))));
const categorySchema=z.object({slug:z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),name:z.string().trim().min(2).max(120),subtitle:z.string().max(160).default(''),icon:z.string().max(32).default('box'),image_url:z.string().max(600).default(''),sort_order:z.number().int().default(0),is_active:z.boolean().default(true)});
app.post('/api/admin/categories',adminOnly,wrap(async(req,res)=>{
  const p=validate(categorySchema,req.body);res.status(201).json((await query(`INSERT INTO categories(slug,name,subtitle,icon,image_url,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,Object.values(p)))[0]);
}));
app.patch('/api/admin/categories/:id',adminOnly,wrap(async(req,res)=>{
  const p=validate(categorySchema,req.body);const r=await query(`UPDATE categories SET slug=$1,name=$2,subtitle=$3,icon=$4,image_url=$5,sort_order=$6,is_active=$7 WHERE id=$8 RETURNING *`,[...Object.values(p),req.params.id]);if(!r.length)throw new HttpError(404,'Категорію не знайдено');res.json(r[0]);
}));
app.get('/api/admin/products',adminOnly,wrap(async(_req,res)=>res.json(await query(`${catalogProduct} ORDER BY p.id DESC LIMIT 500`))));
const variantSchema=z.object({id:z.number().int().positive().optional(),label:z.string().trim().min(1).max(100),sku:z.string().trim().min(1).max(90),stock:z.number().int().min(0).max(100000),price_override:z.number().int().nonnegative().nullable().default(null),is_active:z.boolean().default(true)});
const productSchema=z.object({category_id:z.number().int().positive(),slug:z.string().regex(/^[a-z0-9-]+$/).min(2).max(100),name:z.string().trim().min(2).max(180),brand:z.string().max(100).default(''),subtitle:z.string().max(180).default(''),description:z.string().max(6000).default(''),image_url:z.string().max(600).default(''),gallery:z.array(z.string().max(600)).max(12).default([]),base_price:z.number().int().nonnegative(),compare_at_price:z.number().int().nonnegative().nullable().default(null),badge:z.string().max(30).default(''),is_active:z.boolean().default(true),variants:z.array(variantSchema).min(1).max(80)});
async function saveProduct(p:z.infer<typeof productSchema>,id?:number){
  return tx(async c=>{
    const row=id?(await c.query(`UPDATE products SET category_id=$1,slug=$2,name=$3,brand=$4,subtitle=$5,description=$6,image_url=$7,gallery=$8::jsonb,base_price=$9,compare_at_price=$10,badge=$11,is_active=$12 WHERE id=$13 RETURNING id`,[p.category_id,p.slug,p.name,p.brand,p.subtitle,p.description,p.image_url,JSON.stringify(p.gallery),p.base_price,p.compare_at_price,p.badge,p.is_active,id])).rows[0]:
      (await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,image_url,gallery,base_price,compare_at_price,badge,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12) RETURNING id`,[p.category_id,p.slug,p.name,p.brand,p.subtitle,p.description,p.image_url,JSON.stringify(p.gallery),p.base_price,p.compare_at_price,p.badge,p.is_active])).rows[0];
    if(!row)throw new HttpError(404,'Товар не знайдено');
    const seen:number[]=[];
    for(const v of p.variants){
      const saved=v.id?await c.query('UPDATE variants SET label=$1,sku=$2,stock=$3,price_override=$4,is_active=$5 WHERE id=$6 AND product_id=$7 RETURNING id',[v.label,v.sku,v.stock,v.price_override,v.is_active,v.id,row.id]):
        await c.query('INSERT INTO variants(product_id,label,sku,stock,price_override,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[row.id,v.label,v.sku,v.stock,v.price_override,v.is_active]);
      if(!saved.rows.length)throw new HttpError(400,'Неправильний ID варіанту');
      seen.push(saved.rows[0].id);
    }
    // Removed variants are deactivated (never deleted, so historical orders keep their snapshot).
    await c.query('UPDATE variants SET is_active=false WHERE product_id=$1 AND NOT(id=ANY($2::int[]))',[row.id,seen]);
    return row.id;
  });
}
app.post('/api/admin/products',adminOnly,wrap(async(req,res)=>{const id=await saveProduct(validate(productSchema,req.body));res.status(201).json({id});}));
app.patch('/api/admin/products/:id',adminOnly,wrap(async(req,res)=>{const id=await saveProduct(validate(productSchema,req.body),Number(req.params.id));res.json({id});}));
app.get('/api/admin/banners',adminOnly,wrap(async(_req,res)=>res.json(await query('SELECT * FROM banners ORDER BY sort_order,id'))));
const bannerSchema=z.object({eyebrow:z.string().max(80).default(''),title:z.string().min(2).max(180),subtitle:z.string().max(500).default(''),image_url:z.string().max(600).default(''),button_text:z.string().max(80).default('Дивитися'),button_link:z.string().regex(/^\/[a-zA-Z0-9/_-]*$/).default('/catalog'),kind:z.enum(['hero','bonus','promo']).default('promo'),sort_order:z.number().int().default(0),is_active:z.boolean().default(true)});
app.post('/api/admin/banners',adminOnly,wrap(async(req,res)=>{const b=validate(bannerSchema,req.body);res.status(201).json((await query('INSERT INTO banners(eyebrow,title,subtitle,image_url,button_text,button_link,kind,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',Object.values(b)))[0]);}));
app.patch('/api/admin/banners/:id',adminOnly,wrap(async(req,res)=>{const b=validate(bannerSchema,req.body);const r=await query('UPDATE banners SET eyebrow=$1,title=$2,subtitle=$3,image_url=$4,button_text=$5,button_link=$6,kind=$7,sort_order=$8,is_active=$9 WHERE id=$10 RETURNING *',[...Object.values(b),req.params.id]);if(!r.length)throw new HttpError(404,'Банер не знайдено');res.json(r[0]);}));
app.get('/api/admin/coupons',adminOnly,wrap(async(_req,res)=>res.json(await query('SELECT * FROM coupons ORDER BY id DESC'))));
const couponSchema=z.object({code:z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform(x=>x.toUpperCase()),kind:z.enum(['percent','fixed']),value:z.number().int().positive(),min_subtotal:z.number().int().nonnegative().default(0),max_uses:z.number().int().positive().nullable().default(null),is_active:z.boolean().default(true)}).refine(c=>c.kind!=='percent'||c.value<=100,{message:'Відсоток не може перевищувати 100'});
app.post('/api/admin/coupons',adminOnly,wrap(async(req,res)=>{const c=validate(couponSchema,req.body);res.status(201).json((await query('INSERT INTO coupons(code,kind,value,min_subtotal,max_uses,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',Object.values(c)))[0]);}));
app.patch('/api/admin/coupons/:id',adminOnly,wrap(async(req,res)=>{const c=validate(couponSchema,req.body);const r=await query('UPDATE coupons SET code=$1,kind=$2,value=$3,min_subtotal=$4,max_uses=$5,is_active=$6 WHERE id=$7 RETURNING *',[...Object.values(c),req.params.id]);if(!r.length)throw new HttpError(404,'Промокод не знайдено');res.json(r[0]);}));
app.post('/api/admin/age/verify',adminOnly,wrap(async(req,res)=>{
  const input=validate(z.object({telegram_id:z.string().regex(/^\d+$/),verified:z.boolean()}),req.body);
  const users=await query('UPDATE users SET age_verified=$1 WHERE telegram_id=$2 RETURNING telegram_id,age_verified',[input.verified,input.telegram_id]);
  if(!users.length)throw new HttpError(404,'Користувача не знайдено');
  res.json({ok:true,age_verified:users[0].age_verified});
}));
app.post('/api/admin/bonuses/adjust',adminOnly,wrap(async(req,res)=>{
  const input=validate(z.object({telegram_id:z.string().regex(/^\d+$/),delta:z.number().int().min(-100000).max(100000).refine(x=>x!==0),description:z.string().trim().min(3).max(160)}),req.body);
  const value=await tx(async c=>{
    const u=(await c.query('SELECT * FROM users WHERE telegram_id=$1 FOR UPDATE',[input.telegram_id])).rows[0];if(!u)throw new HttpError(404,'Користувача не знайдено');
    if(u.bonus_balance+input.delta<0)throw new HttpError(400,'Недостатньо бонусів');
    await c.query('UPDATE users SET bonus_balance=bonus_balance+$1 WHERE id=$2',[input.delta,u.id]);
    await c.query('INSERT INTO bonus_ledger(user_id,delta,description) VALUES($1,$2,$3)',[u.id,input.delta,input.description]);
    return u.bonus_balance+input.delta;
  });res.json({balance:value});
}));
// UI served by the SAME origin as API to avoid Telegram iOS third-party-cookie problems.
const staticDir=path.join(process.cwd(),'dist');
app.use(express.static(staticDir,{maxAge:'1h',index:false}));
app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'API route not found'});res.sendFile(path.join(staticDir,'index.html'));});
app.use((err:any,_req:Request,res:Response,_next:NextFunction)=>{
  if(res.headersSent)return;
  if(err instanceof ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});
  if(err?.code==='23505')return res.status(409).json({error:'Запис із такими даними вже існує'});
  if(err?.code==='23503')return res.status(400).json({error:'Пов’язаний запис не існує'});
  if(err?.code==='23514')return res.status(400).json({error:'Невірне значення поля'});
  const code=err instanceof HttpError?err.status:500;
  if(code===500)console.error('SERVER ERROR',err);
  res.status(code).json({error:code===500?'Помилка сервера. Спробуйте пізніше':err.message});
});
async function main(){
  validateConfig();await migrate();
  if(config.seed)await seed();
  if(config.botToken)await initBot().catch(e=>console.error('Telegram setup failed; server remains available:',e));
  const server=app.listen(config.port,'0.0.0.0',()=>console.log(`VAPORIA server on port ${config.port}`));
  const stop=()=>{server.close(()=>{void pool.end().finally(()=>process.exit(0));});};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
if(require.main===module)main().catch(err=>{console.error('Startup error',err);process.exit(1);});
export {app};
