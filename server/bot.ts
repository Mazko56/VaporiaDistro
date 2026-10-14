import {Bot, InlineKeyboard} from 'grammy';
import {config} from './config';
import {query} from './db';
let bot:Bot | undefined;
export async function initBot(){
  if(!config.botToken)return;
  bot=new Bot(config.botToken);
  const url=config.publicUrl;
  const keyboard=url ? new InlineKeyboard().webApp('🛍 Відкрити VAPORIA DISTRO',url) : undefined;
  bot.command('start',async ctx=>{
    await ctx.reply('Вітаємо в VAPORIA DISTRO! 👑\nКаталог, замовлення та бонуси — у нашому Mini App. Доступ тільки для повнолітніх 18+.',{reply_markup:keyboard});
  });
  bot.command('catalog',async ctx=>{await ctx.reply('Перейдіть у магазин та оберіть категорію:',{reply_markup:keyboard});});
  bot.command('myid',async ctx=>{await ctx.reply(`Ваш Telegram ID: ${ctx.from?.id||'не знайдено'}`);});
  // Telegram's command menu supports only Latin characters, but the Ukrainian
  // text command /админ is also accepted when sent as a normal message.
  const adminAccess=async (ctx: any)=>{
    if(!config.adminIds.has(String(ctx.from?.id)) && !(await query('SELECT telegram_id FROM extra_admins WHERE telegram_id=$1',[String(ctx.from?.id)])).length) {
      await ctx.reply('⛔ Цей розділ доступний лише адміністратору.');
      return;
    }
    if(!url){await ctx.reply('Адмінпанель поки недоступна: PUBLIC_URL не налаштовано.');return;}
    await ctx.reply('👑 Адмінпанель VAPORIA DISTRO',{
      reply_markup:new InlineKeyboard().webApp('🔐 Відкрити адмінпанель',`${url}/admin`)
    });
  };
  bot.command('admin',adminAccess);
  bot.hears(/^\/админ(?:@[a-zA-Z0-9_]+)?(?:\s|$)/iu,adminAccess);
  bot.command('help',async ctx=>{await ctx.reply('Команди: /start — відкрити магазин, /catalog — каталог. Питання щодо замовлень вирішує менеджер магазину.');});
  bot.catch(err=>console.error('Bot update error:',err.message));
  // grammY must load bot info via getMe() before handleUpdate() can process webhooks.
  await bot.init();
  console.log(`Telegram bot initialized as @${bot.botInfo.username}`);
  if(url){
    await bot.api.setWebhook(`${url}/api/telegram/webhook`,{secret_token:config.webhookSecret,allowed_updates:['message','callback_query']});
    await bot.api.setChatMenuButton({menu_button:{type:'web_app',text:'VAPORIA DISTRO',web_app:{url}}});
    await bot.api.setMyCommands([{command:'start',description:'Відкрити магазин'},{command:'catalog',description:'Каталог'},{command:'help',description:'Допомога'},{command:'myid',description:'Дізнатись мій Telegram ID'}]);
    // Add /admin only to the owner's private chat command menu; /админ
    // remains supported as plain text because Telegram menu rejects Cyrillic commands.
    try {
      await bot.api.setMyCommands([{command:'start',description:'Відкрити магазин'},{command:'admin',description:'Адмінпанель'}],{
        scope:{type:'chat',chat_id:5138418509}
      });
    } catch (error) { console.warn('Admin chat commands not set yet (owner may need to press /start):',error); }
    console.log('Telegram webhook and menu button configured');
  }
}
export async function handleTelegramUpdate(update:unknown) {
  if(!bot)throw new Error('Telegram bot is not ready; update will be retried by Telegram');
  await bot.handleUpdate(update as any);
}
export type OrderNotification = {orderId:number;deliveryMethod:string;city:string;branch:string;paymentMethod:string;bonusUsed:number};
// Telegram users must first open the bot and press Start to allow direct messages.
// One notification is sent to every active admin who has access to orders.
export async function notifyOrder(number:string,telegramId:string,totalKop:number,details:OrderNotification) {
  if(!bot)return;
  try {await bot.api.sendMessage(telegramId,`✅ Ваше замовлення прийнято!\nСума: ${(totalKop/100).toFixed(2)} ₴.\nОчікуйте підтвердження менеджера.`);} catch(e){console.warn('User notification failed:',e);}
  let rows:{product_name:string;variant_label:string;quantity:number;unit_price:number}[]=[];
  let customer:{customer_name:string;phone:string;comment:string}|undefined;
  try {
    rows=await query(`SELECT product_name,variant_label,quantity,unit_price FROM order_items WHERE order_id=$1 ORDER BY id`,[details.orderId]);
    customer=(await query('SELECT customer_name,phone,comment FROM orders WHERE id=$1',[details.orderId]))[0];
  } catch(e){console.warn('Order notification details unavailable:',e);}
  const lines=rows.map(r=>`• ${r.product_name} (${r.variant_label}) ×${r.quantity} — ${(r.unit_price*r.quantity/100).toFixed(2)} ₴`).join('\n');
  const admin=`🛒 Нове замовлення №${number}\n\n`+
    (customer?`Клієнт: ${customer.customer_name}\nТелефон: ${customer.phone}\n`:'')+
    `Telegram ID: ${telegramId}\n\n`+
    (lines?`Товари:\n${lines}\n\n`:'')+
    `Сума: ${(totalKop/100).toFixed(2)} ₴\nДоставка: Нова пошта\nМісто: ${details.city}\nВідділення: ${details.branch}\n`+
    `Оплата: ${details.paymentMethod==='cod'?'Накладений платіж':details.paymentMethod}\nБонуси: ${details.bonusUsed}`+
    (customer?.comment?`\nКоментар: ${customer.comment}`:'')+
    `\n\nАдмінпанель: ${config.publicUrl}/admin`;
  const recipients=new Set<string>(config.adminIds);
  try {
    const additional=await query('SELECT telegram_id,sections FROM extra_admins');
    for(const item of additional){if(Array.isArray(item.sections)&&item.sections.includes('orders'))recipients.add(String(item.telegram_id));}
  }catch(e){console.warn('Could not load additional admins for order notifications:',e);}
  if(config.adminChatId)recipients.add(config.adminChatId);
  for(const chatId of recipients){
    try {await bot.api.sendMessage(chatId,admin.length<=4096?admin:admin.slice(0,4000)+'\n… (повний склад замовлення — в адмінпанелі)');}
    catch(e){console.warn(`Order notification failed for chat ${chatId}:`,e);}
  }
}
export async function notifyStatus(telegramId:string,status:string,bonusAwarded=0) {
  const labels:Record<string,string>={confirmed:'підтверджено',shipped:'відправлено',completed:'виконано',received:'отримано',cancelled:'скасовано'};
  if(!bot)return;
  try{await bot.api.sendMessage(telegramId,`📦 Статус вашого замовлення: ${labels[status]||status}.`+(status==='received'&&bonusAwarded>0?`\n👑 Нараховано ${bonusAwarded} бонусів на ваш баланс.`:''));}catch(e){console.warn('Status message failed:',e);}
}
