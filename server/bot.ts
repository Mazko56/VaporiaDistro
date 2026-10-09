import {Bot, InlineKeyboard} from 'grammy';
import {config} from './config';
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
  bot.command('help',async ctx=>{await ctx.reply('Команди: /start — відкрити магазин, /catalog — каталог. Питання щодо замовлень вирішує менеджер магазину.');});
  bot.catch(err=>console.error('Bot update error:',err.message));
  // grammY must load bot info via getMe() before handleUpdate() can process webhooks.
  await bot.init();
  console.log(`Telegram bot initialized as @${bot.botInfo.username}`);
  if(url){
    await bot.api.setWebhook(`${url}/api/telegram/webhook`,{secret_token:config.webhookSecret,allowed_updates:['message','callback_query']});
    await bot.api.setChatMenuButton({menu_button:{type:'web_app',text:'VAPORIA DISTRO',web_app:{url}}});
    await bot.api.setMyCommands([{command:'start',description:'Відкрити магазин'},{command:'catalog',description:'Каталог'},{command:'help',description:'Допомога'},{command:'myid',description:'Дізнатись мій Telegram ID'}]);
    console.log('Telegram webhook and menu button configured');
  }
}
export async function handleTelegramUpdate(update:unknown) {
  if(!bot)throw new Error('Telegram bot is not ready; update will be retried by Telegram');
  await bot.handleUpdate(update as any);
}
export async function notifyOrder(number:string,telegramId:string,totalKop:number) {
  if(!bot)return;
  const message=`✅ Замовлення №${number} прийнято!\nСума: ${(totalKop/100).toFixed(2)} ₴.\nОчікуйте підтвердження менеджера.`;
  try {await bot.api.sendMessage(telegramId,message);} catch(e){console.warn('User notification failed:',e);}
  const admin=`🛒 Нове замовлення №${number}\nСума: ${(totalKop/100).toFixed(2)} ₴\nКлієнт: ${telegramId}\nПеревірте адмінпанель: ${config.publicUrl}/admin`;
  if(config.adminChatId)try{await bot.api.sendMessage(config.adminChatId,admin);}catch(e){console.warn('Admin notification failed:',e);}
}
export async function notifyStatus(telegramId:string, number:string,status:string) {
  const labels:Record<string,string>={confirmed:'підтверджено',shipped:'відправлено',completed:'виконано',received:'отримано',cancelled:'скасовано'};
  if(!bot)return;
  try{await bot.api.sendMessage(telegramId,`📦 Замовлення №${number}: ${labels[status]||status}.`);}catch(e){console.warn('Status message failed:',e);}
}
