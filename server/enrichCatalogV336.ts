import {tx} from './db';
const flavors=['Blime Berries','Citrine Nectar','Emerald Garden','Pink Sapphire','Ruby Elixir'];
const description='Лінійка Gems створена для тих, хто любить яскраві фруктові, ягідні та освіжаючі профілі з виразним характером. Кожен смак звучить насичено та збалансовано: на вдиху — основний акцент, у середині — глибина композиції, на видиху — приємний, рівний післясмак без перевантаження солодкістю.';
export async function enrichCatalogV336(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const marker=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v3.3.6-hype-gems') ON CONFLICT DO NOTHING RETURNING version");
  if(!marker.rowCount)return;
  const slug='hype-gems-30ml';
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,badge,is_active)
    SELECT id,$1,'HYPE GEMS 30ml','HYPE','GEMS • 30 мл',$2,34900,'НОВИНКА',true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`,[slug,description]);
  const product=(await c.query('SELECT id FROM products WHERE slug=$1',[slug])).rows[0];
  if(!product)throw Error('HYPE GEMS product was not created');
  for(let i=0;i<flavors.length;i++)await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
    VALUES($1,$2,$3,100,true) ON CONFLICT(sku) DO NOTHING`,[product.id,flavors[i],`v336-hype-gems-${i+1}`]);
 });
 console.log('Catalog v3.3.6: HYPE GEMS 30ml, 5 flavors');
}
