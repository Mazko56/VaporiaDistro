import {tx} from './db';

const chaserDescription = 'Chaser — це один із найвідоміших та найуспішніших українських брендів, який з 2018 року спеціалізується на виробництві високоякісних ароматизаторів. Головна концепція компанії — лабораторна точність, збалансовані рецептури та європейські стандарти за доступною українською ціною.';

const chaserFP = [
  'Апельсин','Банан','Барбарис','Блакитна Малина','Виноград','Вишня','Вишня Ментол','Жовта Малина','Журавлина','Кавун','Кавун Ментол','Кисла Чорниця','Ківі','Крижана Малина','Лимон',"М'ята",'Персик','Полуниця','Смородина Ментол','Чорниця Ментол','Ягоди'
];

const chaserBeat = [
  'Arctic House','Bass Berry','Bubble Berry Tune','Cherry Pulse','Grape Cherry','Grape Techno','Pineapple Bass'
];

const chaserLux = [
  'Apple Peach','Berry Lemonade','Blackcurrant Lemon Peach','Blueberry Mint','Blueberry Raspberry','Cherry Lemon','Coconut Melon','Grape Mint','Ice Latte','Kiwi Aloe Lime','Mango Nectar','Orangeade','Peach Tea','Sangria','Sour Apple','Strawberry Cream','Tropic Punch','Vitamin','Watermelon Bubblegum','Watermelon Raspberry'
];

function normalize(s:string){
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/giu,'');
}

async function ensureProduct(c:any, slug:string, name:string, subtitle:string, price:number, image:string){
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,$1,$2,'CHASER',$3,$4,$5,$6,true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`, [slug,name,subtitle,chaserDescription,price,image]);
  await c.query(`UPDATE products SET name=$1,brand='CHASER',subtitle=$2,description=$3,base_price=$4,compare_at_price=NULL,image_url=$5,is_active=true WHERE slug=$6`,
    [name,subtitle,chaserDescription,price,image,slug]);
}

async function setVariants(c:any, slug:string, names:string[]){
  const product = (await c.query('SELECT id FROM products WHERE slug=$1',[slug])).rows[0];
  if(!product) throw new Error(`Missing product ${slug}`);
  const rows = (await c.query('SELECT id,label,sku FROM variants WHERE product_id=$1 ORDER BY id',[product.id])).rows;
  const used = new Set<number>();
  for(let i=0;i<names.length;i++){
    const name = names[i];
    const matched = rows.find((r:any)=>!used.has(r.id) && normalize(r.label)===normalize(name));
    if(matched){
      used.add(matched.id);
      await c.query('UPDATE variants SET label=$1,stock=100,is_active=true WHERE id=$2',[name,matched.id]);
    } else {
      const sku = `v26-${slug}-${i+1}`;
      const inserted = await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
        VALUES($1,$2,$3,100,true)
        ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,stock=100,is_active=true RETURNING id`, [product.id,name,sku]);
      used.add(inserted.rows[0].id);
    }
  }
  for(const row of rows){
    if(!used.has(row.id)) await c.query('UPDATE variants SET is_active=false WHERE id=$1',[row.id]);
  }
  const check = (await c.query('SELECT count(*)::int AS n FROM variants WHERE product_id=$1 AND is_active',[product.id])).rows[0].n;
  if(check !== names.length) throw new Error(`Flavor count mismatch for ${slug}: ${check}`);
}

export async function enrichCatalogV26(){
  await tx(async c=>{
    await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const once = await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.6-chaser') ON CONFLICT DO NOTHING RETURNING version");
    if(!once.rowCount) return;

    await ensureProduct(c,'photo-set-9094','Chaser 30ml for pods','F/P • 30 мл',30000,'/catalog-import/product-9094.webp');
    await ensureProduct(c,'photo-set-9093','Chaser Beat 30ml','BEAT • 30 мл',34900,'/catalog-import/product-9093.webp');
    await ensureProduct(c,'chaser-lux-ultra-30ml-v19','Chaser Lux Ultra 30ml','LUX ULTRA • 30 мл',34900,'/catalog-import/product-9091.webp');

    const keep = ['photo-set-9094','photo-set-9093','chaser-lux-ultra-30ml-v19'];
    await c.query("UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='CHASER' AND NOT (slug = ANY($1::text[]))", [keep]);

    await setVariants(c,'photo-set-9094',chaserFP);
    await setVariants(c,'photo-set-9093',chaserBeat);
    await setVariants(c,'chaser-lux-ultra-30ml-v19',chaserLux);

    const p = (await c.query("SELECT count(*)::int AS n FROM products WHERE UPPER(TRIM(brand))='CHASER' AND is_active")).rows[0].n;
    if(p !== 3) throw new Error(`Expected 3 active CHASER products, found ${p}`);
  });
  console.log('Catalog enrichment v2.6: Chaser F/P 21, Beat 7, Lux Ultra 20; stock=100');
}
