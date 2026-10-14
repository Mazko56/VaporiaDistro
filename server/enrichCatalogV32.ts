import {tx} from './db';

const flavors=[
'Apple Peach','Blackberry Lemon','Blue Razz Lemonade','Blueberry','Blueberry Sour Raspberry','Cherry','Cherry Cola','Cherry Lemon Peach','Elf Jack','Elfbull Ice','Grape','Grape Cherry','Lemon Lime','Peach Ice','Pear Cranberry Lemon','Pina Colada','Spearmint','Strawberry Cherry Lemon','Strawberry Ice','Strawberry Kiwi','Strawberry Raspberry Cherry Ice','Watermelon','Watermelon Cherry','Watermelon Sour Peach','Wild Berries Baja Splash'
];
const description='Для виробництва були використані найкращі преміальні компоненти. Завдяки найвищій якості складників, смакопередача та післясмак просто неперевершені. Elf Bar знову задав високу планку, але тепер на ринку рідин для заправки електронних сигарет.';
export async function enrichCatalogV32(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const marker=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v3.2-elfliq') ON CONFLICT DO NOTHING RETURNING version");
  if(!marker.rowCount)return;
  const slug='photo-set-9111';
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,$1,$2,'ELFLIQ','30 мл',$3,34900,'/catalog-import/product-9111.webp',true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`,[slug,'ELF LIQ 30ml',description]);
  await c.query(`UPDATE products SET name='ELF LIQ 30ml',brand='ELFLIQ',subtitle='30 мл',description=$1,base_price=34900,compare_at_price=NULL,image_url='/catalog-import/product-9111.webp',is_active=true WHERE slug=$2`,[description,slug]);
  await c.query("UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='ELFLIQ' AND slug<>$1",[slug]);
  const product=(await c.query('SELECT id FROM products WHERE slug=$1',[slug])).rows[0];
  if(!product)throw Error('ELF LIQ product missing');
  const old=(await c.query('SELECT id FROM variants WHERE product_id=$1 ORDER BY id',[product.id])).rows;
  await c.query('UPDATE variants SET is_active=false WHERE product_id=$1',[product.id]);
  for(let i=0;i<flavors.length;i++){
    const sku=`v32-elfliq-${i+1}`;
    await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active) VALUES($1,$2,$3,100,true)
      ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,stock=100,is_active=true`,[product.id,flavors[i],sku]);
  }
  const count=(await c.query('SELECT count(*)::int AS n FROM variants WHERE product_id=$1 AND is_active',[product.id])).rows[0].n;
  if(count!==25)throw Error('ELF LIQ flavor count: '+count);
 });
 console.log('Catalog v3.2: ELF LIQ 30ml, 25 flavors, 100 each');
}
