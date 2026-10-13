import {tx} from './db';

const mood10 = [
  'Apple Mint','Bilberry Ice','Blueberry Menthol','Cherry Cola','Cherry Menthol','Chill Peach',
  'Citrus Paradise','Cool Mint','Currant Menthol','Dragonfruit Ice','Forest Berries','Granato Rosso',
  'Grape Mint','Lemon Mint','Orbit Splash','Pineapple Frost','Raspberry Lemonade','Sour Apple Ice',
  'Strawberry RedBull','Tobacco','Watermelon Ice'
];

const mood30 = [
  'Apple Mint','Bilberry Ice','Blueberry Menthol','Cherry Cola','Cherry Menthol','Chill Peach',
  'Citrus Paradise','Cool Mint','Currant Menthol','Dragonfruit Ice','Forest Berries','Granato Rosso',
  'Grape Mint','Lemon Mint','Orbit Splash','Pineapple Frost','Raspberry Lemonade','Sour Apple Ice',
  'Strawberry RedBull','Tobacco','Watermelon Ice'
];

const quack = [
  'Apple Pomegranate','Blue Razz','Blueberry Lime Mint','Cola Classic','Fresh Mint','Kiwi Lemon',
  'Lemon Mint Candy','Pitaya Peach','Sicilian Orange','Sour Acai Berries','Sour Pineapple','Sweet Cherry'
];

const mood10Description = 'Ароматизатор Mood Duck — це серія ароматизаторів яка поєднує популярні фруктові та освіжаючі смаки. Лінійка створена для поціновувачів насичених ароматів, яскравої смакопередачі та збалансованих композицій. Кожен аромат добре розкривається в POD-системах та забезпечує стабільний смак протягом усього використання.';
const mood30Description = 'Mood Duck — оригінальний бренд із нестандартним оформленням і власним стилем. Поєднує яскраву айдентику, різноманіття смаків та впізнавану подачу, що виділяє його серед інших брендів.';
const quackDescription = 'Quack Attack — це спеціальна, більш динамічна лінійка в сімействі українського бренду Mood Duck, створена в масштабній колаборації з іншим відомим виробником вейп-продукції — Hype.';

function normalize(s:string){
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/giu,'');
}

async function ensureProduct(c:any, slug:string, name:string, brand:string, subtitle:string, description:string, price:number, image:string){
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,$1,$2,$3,$4,$5,$6,$7,true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`, [slug,name,brand,subtitle,description,price,image]);
  await c.query(`UPDATE products SET name=$1,brand=$2,subtitle=$3,description=$4,base_price=$5,compare_at_price=NULL,
    image_url=$6,is_active=true WHERE slug=$7`, [name,brand,subtitle,description,price,image,slug]);
}

async function setVariants(c:any, slug:string, names:string[]){
  const product = (await c.query('SELECT id FROM products WHERE slug=$1',[slug])).rows[0];
  if(!product) throw new Error(`Missing product ${slug}`);
  const rows = (await c.query('SELECT id,label FROM variants WHERE product_id=$1 ORDER BY id',[product.id])).rows;
  const used = new Set<number>();
  for(let i=0;i<names.length;i++){
    const name=names[i];
    const matched=rows.find((r:any)=>!used.has(r.id) && normalize(r.label)===normalize(name));
    if(matched){
      used.add(matched.id);
      await c.query('UPDATE variants SET label=$1,is_active=true,stock=100 WHERE id=$2',[name,matched.id]);
    } else {
      const sku=`v25-${slug}-${i+1}`;
      const res=await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
        VALUES($1,$2,$3,100,true)
        ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,is_active=true,stock=100 RETURNING id`, [product.id,name,sku]);
      used.add(res.rows[0].id);
    }
  }
  for(const row of rows){
    if(!used.has(row.id)) await c.query('UPDATE variants SET is_active=false WHERE id=$1',[row.id]);
  }
  const check=(await c.query('SELECT count(*)::int AS n FROM variants WHERE product_id=$1 AND is_active',[product.id])).rows[0].n;
  if(check!==names.length) throw new Error(`Flavor count mismatch for ${slug}: ${check}`);
}

export async function enrichCatalogV25(){
  await tx(async c=>{
    await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const once=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.5-moodduck-quack') ON CONFLICT DO NOTHING RETURNING version");
    if(!once.rowCount) return;

    await ensureProduct(c,'photo-set-9085','Mood Duck 10ml','MOOD','10 мл',mood10Description,14900,'/catalog-import/product-9085.webp');
    await ensureProduct(c,'photo-set-9087','Mood Duck 30ml','MOOD','30 мл',mood30Description,34900,'/catalog-import/product-9087.webp');
    await ensureProduct(c,'photo-set-9089','Quack Attack 30ml','DUCK','30 мл',quackDescription,34900,'/catalog-import/product-9089.webp');

    await c.query("UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='MOOD' AND slug <> ALL($1::text[])", [['photo-set-9085','photo-set-9087']]);
    await c.query("UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='DUCK' AND slug <> 'photo-set-9089'");

    await setVariants(c,'photo-set-9085',mood10);
    await setVariants(c,'photo-set-9087',mood30);
    await setVariants(c,'photo-set-9089',quack);

    const moodCount=(await c.query("SELECT COUNT(*)::int AS n FROM products WHERE UPPER(TRIM(brand))='MOOD' AND is_active")).rows[0].n;
    const duckCount=(await c.query("SELECT COUNT(*)::int AS n FROM products WHERE UPPER(TRIM(brand))='DUCK' AND is_active")).rows[0].n;
    if(moodCount!==2) throw new Error(`Expected 2 active MOOD products, found ${moodCount}`);
    if(duckCount!==1) throw new Error(`Expected 1 active DUCK product, found ${duckCount}`);
  });
  console.log('Catalog v2.5: Mood Duck 10ml (21), Mood Duck 30ml (21), Quack Attack 30ml (12), stock=100');
}
