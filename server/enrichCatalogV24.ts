import {tx} from './db';

const octobarFlavors = [
 'Apple Mint Candy', 'Apricot Lime', 'Berry Juice', 'Blueberry Soda', 'Citrus Candy',
 'Forest Berries', 'Grape Ice', 'Lemon Tea', 'Mojito', 'Pineapple Mojito',
 'Raspberry Basil', 'Secret', 'Sicilian Orange', 'Tarhun Lemonade', 'Watermelon Peach Lime'
];
const octobarDescription = 'Octobar Prime — це універсальна лінійка створена для тих, хто цінує глибину смаку й стабільну якість. Вона не кричить, а переконує. Саме тому її обирають досвідчені користувачі POD-систем, які вже встигли спробувати десятки ароматів і шукають щось стабільне, виразне й добре збалансоване.';

export async function enrichCatalogV24() {
 await tx(async c => {
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const once = await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.4-octobar-default-stock-100') ON CONFLICT DO NOTHING RETURNING version");
  if (!once.rowCount) return;

  // Reuse the existing Octobar photo/product instead of producing a duplicate.
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,image_url,base_price,is_active)
    SELECT id,'photo-set-9115','Octobar Prime 30ml','OCTOLAB','Prime • 30 мл',$1,
      '/catalog-import/product-9115.webp',34900,true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`, [octobarDescription]);
  await c.query(`UPDATE products SET name='Octobar Prime 30ml',brand='OCTOLAB',subtitle='Prime • 30 мл',
    description=$1,base_price=34900,compare_at_price=NULL,
    image_url=CASE WHEN image_url='' THEN '/catalog-import/product-9115.webp' ELSE image_url END,
    is_active=true WHERE slug='photo-set-9115'`, [octobarDescription]);
  await c.query(`UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='OCTOLAB' AND slug <> 'photo-set-9115'`);
  const product = (await c.query("SELECT id FROM products WHERE slug='photo-set-9115'")).rows[0];
  if (!product) throw Error('Octobar product was not found');

  const existing = (await c.query('SELECT id,label FROM variants WHERE product_id=$1 ORDER BY id',[product.id])).rows;
  const norm=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const used = new Set<number>();
  for (let i=0;i<octobarFlavors.length;i++) {
   const label=octobarFlavors[i];
   const matched=existing.find((r:any)=>!used.has(r.id) && norm(r.label)===norm(label));
   if (matched) {
    used.add(matched.id);
    await c.query('UPDATE variants SET label=$1,is_active=true WHERE id=$2',[label,matched.id]);
   } else {
    const sku=`octobar-prime-v24-${i+1}`;
    const result=await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
      VALUES($1,$2,$3,100,true) ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,is_active=true RETURNING id`,[product.id,label,sku]);
    used.add(result.rows[0].id);
   }
  }
  for (const r of existing) if (!used.has(r.id)) await c.query('UPDATE variants SET is_active=false WHERE id=$1',[r.id]);

  // User-requested initial stock: 100 of every active variant, exactly once.
  // Future stock changes and sales are not reset on redeploy.
  await c.query(`UPDATE variants SET stock=100
    WHERE is_active=true AND product_id IN (SELECT id FROM products WHERE is_active=true)`);

  const verify=(await c.query(`SELECT COUNT(*)::int AS n FROM variants WHERE product_id=$1 AND is_active`,[product.id])).rows[0].n;
  if(verify!==octobarFlavors.length) throw Error(`Octobar flavor count mismatch: ${verify}`);
 });
 console.log('Catalog v2.4: Octobar Prime 15 flavors; active variants initialized to 100 units once');
}
