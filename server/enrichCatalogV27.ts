import {tx} from './db';

type Model = {slug:string;name:string;price:number;photo:string;summary:string;specs:[string,string][];colors:string[]};
const models:Model[]=[
 {slug:'oxva-xlim-go-2-v19',name:'OXVA XLIM GO 2',price:59900,photo:'/catalog-import/product-9038.webp',summary:'OXVA Xlim Go 2 — оновлена версія легендарної под-системи, яка поєднує стиль, потужність і функціональність. Завдяки акумулятору ємністю 1500 мА·год і регульованій потужності до 30 Вт пристрій забезпечує стабільну роботу протягом усього дня без частих підзарядок.',specs:[['🔋 Акумулятор','1500 мА·год'],['⚙️ Потужність','До 30 Вт, регульована'],['💧 Картридж','2–3 мл'],['🌬️ Обдув','Регульований'],['🔌 Зарядка','USB Type-C'],['💨 Сумісність','XLIM: 0.4 / 0.6 / 0.8 / 1.2 Ом'],['🧠 Активація','Автоматична, від затяжки']],colors:['Aurora Pink Blue','Aurora Starry Purple','Black Carbon','Black Shadow','Blue Ripple','Green Ripple','Light Brown Shadow','Metal Blue','Metal Silver','Pink Ripple','Shell Pink','Shell White','Weave Black','Weave Brown']},
 {slug:'oxva-xlim-go-lite-v19',name:'OXVA XLIM GO Lite',price:49900,photo:'/catalog-import/product-9036.webp',summary:'Oxva Xlim Go Lite Pod — надзвичайно легка, ергономічна та збалансована багаторазова pod-система від OXVA. Модель створена для зручного щоденного використання.',specs:[['🧱 Корпус','Полегшений термостійкий полімер і текстуровані вставки'],['🔋 Акумулятор','1000 мА·год'],['⚙️ Потужність','До 25 Вт, автоматичне налаштування'],['💧 Картридж','2 мл, бічна / верхня заправка Top-Fill V3'],['🔌 Зарядка','USB Type-C, 5V / 1A'],['💨 Активація','Автоматична, від затяжки']],colors:['Black','Black Carbon','Brown','Light Blue','Light Pink','Light Purple','Mist Blue','Mist White']},
 {slug:'oxva-xlim-pro-3-v19',name:'OXVA XLIM PRO 3',price:134900,photo:'/catalog-import/product-9041.webp',summary:'OXVA Xlim Pro 3 — pod-система нового покоління, яка поєднує високу потужність, стильний дизайн та інтелектуальні функції. Акумулятор 1500 мА·год підтримує турбозарядку Type-C 5V/2A.',specs:[['🧱 Корпус','Цинковий сплав + PCTG'],['📐 Розміри','119.9 × 25.7 × 15 мм'],['⚖️ Вага','77.4 г'],['🔋 Акумулятор','1500 мА·год'],['⚙️ Потужність','До 45 Вт'],['📺 Екран','1.05″ HD, кольоровий'],['🔌 Зарядка','Type-C 5V/2A, до 30 хв'],['💧 Картридж','2 мл, опір 0.4–1.2 Ω'],['💨 Активація','Автоматична або кнопкою'],['🌬️ Обдув','Бічний слайдер']],colors:['Black Carbon','Black Leather','Brown Leather','Ceramic Black','Ceramic White','Forgen Black','Forgen Blue','Lavender Purple','Pink Silk','Pro Carbon','Purple Silk','Race Red','Retro Brown','Sky Blue','Titanium Silk']},
 {slug:'oxva-nexlim-2-mini-v19',name:'OXVA NeXLIM 2 Mini',price:82900,photo:'/catalog-import/product-9042.webp',summary:'OXVA NeXLIM 2 Mini — компактна pod-система для виразної передачі смаку та простого керування. Працює з картриджами NeXLIM UNITECH 3.0 Dual Mesh.',specs:[['📐 Розміри','113.5 × 28.5 × 18 мм'],['⚖️ Вага','59 г'],['💧 Картридж','2 мл'],['⚙️ Потужність','5–30 Вт'],['🔌 Зарядка','USB Type-C, 5V/2A'],['🔋 Акумулятор','1500 мА·год'],['🎛️ Режими','ECO / BOOST'],['🧱 Корпус','Алюмінієвий сплав'],['💨 Сумісність','NeXLIM UNITECH 3.0 Cartridge']],colors:['Aurora Blue','Classic Black','Golden Hour','Mint Green','Mist Purple','Navy Blue','Sakura Pink','Solar Gold','Titanium Gray']},
 {slug:'photo-set-9044',name:'OXVA NeXLIM 2',price:139900,photo:'/catalog-import/product-9044.webp',summary:'OXVA NeXLIM 2 Pod — флагманська pod-система із батареєю 2000 мА·год, потужністю до 40 Вт та картриджами NeXLIM UNITECH 3.0 Dual Mesh із технологією Super Pulse.',specs:[['📐 Розміри','121 × 28.5 × 17.5 мм'],['⚖️ Вага','88.5 г'],['💧 Картридж','4 мл'],['⚙️ Потужність','5–40 Вт'],['🔌 Зарядка','USB Type-C, 5V/3A'],['🔋 Акумулятор','2000 мА·год'],['🎛️ Режими','ECO / BOOST'],['🧱 Корпус','Цинковий сплав'],['📺 Екран','0.85″ HD, кольоровий'],['🌬️ Затяжка','3-рівневе AFC'],['💨 Сумісність','NeXLIM UNITECH 3.0 Cartridge'],['✨ Технології','UNITECH 3.0 Dual Mesh, Super Pulse, 3x Anti-Leak']],colors:['Black Leather','Black Warrior','Bright Brown Leather','Color Clash','Green Leather','Mocha Brown Leather','Pearly White','Shiny Pink','Shiny Purple']}
];
const normalize=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яіїєґ]+/giu,'');
export async function enrichCatalogV27(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const marker=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.7-oxva-pod-models') ON CONFLICT DO NOTHING RETURNING version");
  if(!marker.rowCount)return;
  for(const model of models){
   const description=model.summary+'\nХарактеристики:\n'+model.specs.map(([k,v])=>k+'|'+v).join('\n');
   await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,compare_at_price,image_url,is_active)
     SELECT id,$1,$2,'OXVA','POD-система',$3,$4,NULL,$5,true FROM categories WHERE slug='pod-systemy'
     ON CONFLICT(slug) DO NOTHING`,[model.slug,model.name,description,model.price,model.photo]);
   await c.query(`UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='pod-systemy'),name=$1,brand='OXVA',subtitle='POD-система',description=$2,base_price=$3,compare_at_price=NULL,image_url=$4,is_active=true WHERE slug=$5`,[model.name,description,model.price,model.photo,model.slug]);
   const item=(await c.query('SELECT id FROM products WHERE slug=$1',[model.slug])).rows[0];
   if(!item) throw Error('OXVA product missing: '+model.slug);
   const existing=(await c.query('SELECT id,label FROM variants WHERE product_id=$1 ORDER BY id',[item.id])).rows;
   const used=new Set<number>();
   for(let i=0;i<model.colors.length;i++){
    const label=model.colors[i];const old=existing.find((v:any)=>!used.has(v.id)&&normalize(v.label)===normalize(label));
    if(old){used.add(old.id);await c.query('UPDATE variants SET label=$1,stock=100,is_active=true WHERE id=$2',[label,old.id]);}
    else{const sku=`v27-${model.slug}-${i+1}`;const row=await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active) VALUES($1,$2,$3,100,true) ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,stock=100,is_active=true RETURNING id`,[item.id,label,sku]);used.add(row.rows[0].id);}
   }
   for(const old of existing)if(!used.has(old.id))await c.query('UPDATE variants SET is_active=false WHERE id=$1',[old.id]);
   const count=(await c.query('SELECT COUNT(*)::int AS n FROM variants WHERE product_id=$1 AND is_active',[item.id])).rows[0].n;
   if(count!==model.colors.length)throw Error(`OXVA color mismatch ${model.slug}: ${count}`);
  }
  const slugs=models.map(m=>m.slug);
  await c.query("UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='OXVA' AND NOT(slug=ANY($1::text[])) AND category_id=(SELECT id FROM categories WHERE slug='pod-systemy')",[slugs]);
  const count=(await c.query("SELECT COUNT(*)::int AS n FROM products WHERE UPPER(TRIM(brand))='OXVA' AND is_active AND category_id=(SELECT id FROM categories WHERE slug='pod-systemy')")).rows[0].n;
  if(count!==5)throw Error('Expected 5 OXVA POD products, found '+count);
 });
 console.log('Catalog v2.7: 5 OXVA POD models, 55 color variants, 100 each');
}
