import 'dotenv/config';
import {pool} from './db';
import {migrate} from './migrate';
const categories=[
  ['ridyny','Рідини','Преміальні смаки','droplets',1],
  ['pod-systemy','POD-Системи','Сучасні пристрої','zap',2],
  ['kartrydzhi','Картриджі','Для улюблених пристроїв','package',3],
  ['nikotynovi-pauchi','Нікотинові паучі','Асортимент смаків','circle',4],
  ['inbottle','INBOTTLE','Фірмова лінійка','crown',5]
] as const;
const products=[
  {cat:'inbottle',slug:'inbottle-evo',name:'INBOTTLE EVO 30ml 50mg',brand:'INBOTTLE',price:35000,old:40000,badge:'ХІТ',color:'#a633ff',subtitle:'Серія EVO • 30 мл',desc:'Демонстраційна картка товару. Замініть опис, фото, наявність і характеристики на реальні в адмінпанелі.',variants:['Lemon lime 🍋','Cherry Sour Apple 🍒','Cafe Latte ☕','Blue razz ice 🧊','Mojito 🌿','Sour raspberry','Grape gummy 🍇']},
  {cat:'ridyny',slug:'hype-hard',name:'HYPE HARD 30ml 70mg',brand:'HYPE',price:32000,old:null,badge:'НОВИНКА',color:'#b420b8',subtitle:'Насичений смак • 30 мл',desc:'Демонстраційний товар. Фото та характеристики можна редагувати в адмінці.',variants:['Ice Orange','Blackcurrant','Berry lemonade']},
  {cat:'pod-systemy',slug:'vaporesso-xros-6',name:'VAPORESSO XROS 6',brand:'VAPORESSO',price:130000,old:140000,badge:'',color:'#327bff',subtitle:'POD-система',desc:'Демонстраційний товар — перевіряйте реальну наявність та характеристики перед продажем.',variants:['Silk Brown','Space Gray','Pink','Ice Blue']},
  {cat:'ridyny',slug:'chaser-beat',name:'CHASER BEAT 30ml 50/65mg',brand:'CHASER',price:30000,old:35000,badge:'АКЦІЯ',color:'#8ee600',subtitle:'Колекція Beat',desc:'Демонстраційна позиція для тестового каталогу.',variants:['Cherry Pulse 🍒','Mango Ice','Green Apple 🍏']},
  {cat:'pod-systemy',slug:'vaporesso-xros-6-mini',name:'VAPORESSO XROS 6 MINI',brand:'VAPORESSO',price:91000,old:100000,badge:'',color:'#7fc3ff',subtitle:'Компактний POD',desc:'Демонстраційний товар.',variants:['Black','Rose','Silver','Orange']},
  {cat:'kartrydzhi',slug:'xros-cartridge',name:'XROS Картридж 0.8Ω',brand:'VAPORESSO',price:16000,old:null,badge:'',color:'#bdc4d9',subtitle:'Змінний картридж',desc:'Демонстраційний товар.',variants:['0.6Ω','0.8Ω','1.0Ω']},
  {cat:'nikotynovi-pauchi',slug:'nord-pouches',name:'NORD POUCHES',brand:'NORD',price:22000,old:null,badge:'',color:'#46f0c3',subtitle:'Демо-каталог',desc:'Демонстраційна позиція.',variants:['Mint ❄️','Berry 🍓']}
];
export async function seed(){
  for(const [slug,name,subtitle,icon,order] of categories){
    await pool.query(`INSERT INTO categories(slug,name,subtitle,icon,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(slug) DO NOTHING`,[slug,name,subtitle,icon,order]);
  }
  for(const p of products){
    const cat=(await pool.query('SELECT id FROM categories WHERE slug=$1',[p.cat])).rows[0];
    const result=await pool.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,compare_at_price,badge) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(slug) DO NOTHING RETURNING id`,[cat.id,p.slug,p.name,p.brand,p.subtitle,p.desc,p.price,p.old,p.badge]);
    if(!result.rows.length)continue;
    for(let i=0;i<p.variants.length;i++){
      await pool.query(`INSERT INTO variants(product_id,label,sku,stock) VALUES($1,$2,$3,$4) ON CONFLICT(sku) DO NOTHING`,[result.rows[0].id,p.variants[i],`${p.slug}-${i+1}`,25]);
    }
  }
  await pool.query(`INSERT INTO banners(eyebrow,title,subtitle,button_text,button_link,kind,sort_order)
    SELECT 'VAPORIA • DISTRO','БІЛЬШЕ НІЖ ПРОСТО ВЕЙП','Твій простір смаку. Відкривай новинки та фаворитів.','ДО КАТАЛОГУ','/catalog','hero',1
    WHERE NOT EXISTS(SELECT 1 FROM banners WHERE kind='hero')`);
  await pool.query(`INSERT INTO banners(eyebrow,title,subtitle,button_text,button_link,kind,sort_order)
    SELECT 'VAPORIA BONUS','КУПУЙ — НАКОПИЧУЙ — ОТРИМУЙ БІЛЬШЕ','5% бонусами після виконаного замовлення','ДЕТАЛІ','/profile','bonus',2
    WHERE NOT EXISTS(SELECT 1 FROM banners WHERE kind='bonus')`);
  await pool.query(`INSERT INTO coupons(code,kind,value,min_subtotal,max_uses) VALUES('WELCOME5','percent',5,30000,100) ON CONFLICT(code) DO NOTHING`);
  console.log('Demo catalog initialized (existing edits preserved)');
}
if(require.main===module) migrate().then(seed).then(()=>pool.end()).catch(e=>{console.error(e);process.exit(1);});
