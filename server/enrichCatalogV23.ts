import {tx} from './db';

const sour=['Sour Apple','Sour Blueberry','Sour Cherry','Sour Grape','Sour Grapefruit','Sour Kiwi','Sour Lemon','Sour Lime','Sour Mandarin','Sour Orange'];
const ice=['Ice Agrus','Ice Blueberry','Ice Cactus','Ice Cherry','Ice Currant','Ice Peach','Ice Red Apple','Ice Spearmint','Ice Watermelon'];
const hype=['Apple','Barbaris','Blackberry','Blueberry','Blueberry Energy','Blueberry Ice Cream','Cactus Lime','Cherry','Grape','Lemon Mint','Lime','Orange Ball','Orbit','Pear','Pineapple','Pink Energy','Spearmint','Strawberry Kiwi','Tropic','Watermelon'];
const neonDescription='PUNCH NEON 30 ML — це лінійка яскравих та насичених ароматизаторів, створена для справжніх фанатів кислих, прохолодних та фруктових смаків. Кожен флакон — це гармонійний баланс кислоти, прохолоди та соковитості, який підійде як для щоденного паріння, так і для тих, хто шукає яскраві враження.';
const classicDescription='Punch — сучасний бренд, що поєднує яскравий стиль, оригінальні смакові поєднання та різноманіття ароматів. Продукція бренду вирізняється впізнаваною концепцією, широким вибором смаків і увагою до деталей. Punch постійно привертає увагу поціновувачів незвичайних смакових комбінацій, пропонуючи варіанти на різні вподобання. Це бренд із власним характером, який робить акцент на індивідуальності, сучасному дизайні та різноманітті асортименту.';
const hypeDescription='Hype - це інноваційний набір для виготовлення рідини від українського виробника. Hype пропонує широкий спектр смаків для вибору, що включають у себе ягідні, фруктові та прохолодні варіанти. Ви можете насолоджуватися неперевершеним смаковим досвідом, обравши той, який вам більше до вподоби.';
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/giu,'');

async function setVariants(c:any,slug:string,names:string[]){
 const found=await c.query('SELECT id FROM products WHERE slug=$1',[slug]);
 if(found.rows.length!==1)throw Error(`Missing product ${slug}`);
 const id=found.rows[0].id;
 const rows=(await c.query('SELECT id,label FROM variants WHERE product_id=$1 ORDER BY id',[id])).rows;
 const used=new Set<number>();
 for(let i=0;i<names.length;i++){
  const name=names[i];const matched=rows.find((v:any)=>!used.has(v.id)&&normalize(v.label)===normalize(name));
  if(matched){used.add(matched.id);await c.query('UPDATE variants SET label=$1,is_active=true WHERE id=$2',[name,matched.id]);}
  else {const sku=`v23-${slug}-${i+1}`;const result=await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active) VALUES($1,$2,$3,0,true) ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,is_active=true RETURNING id`,[id,name,sku]);used.add(result.rows[0].id);}
 }
 for(const row of rows){if(!used.has(row.id))await c.query('UPDATE variants SET is_active=false WHERE id=$1',[row.id]);}
 const check=await c.query('SELECT label FROM variants WHERE product_id=$1 AND is_active',[id]);
 if(check.rows.length!==names.length||new Set(check.rows.map((v:any)=>normalize(v.label))).size!==names.length)throw Error(`Duplicate flavor validation failed: ${slug}`);
}

export async function enrichCatalogV23(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const once=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.3-punch-neon-ice-hype') ON CONFLICT DO NOTHING RETURNING version");
  if(!once.rowCount)return;
  // Reuse all three existing product rows, preserving order/cart references.
  await c.query(`UPDATE products SET name='Punch 30ml', brand='PUNCH', subtitle='30 мл',description=$1,base_price=34900, image_url='/catalog-import/punch-30-v21.png',gallery='[]'::jsonb,is_active=true WHERE slug='punch-30ml-v19'`,[classicDescription]);
  await c.query(`UPDATE products SET name='Punch Neon 30ml',brand='PUNCH',subtitle='NEON • 30 мл',description=$1,base_price=34900,image_url='/catalog-import/punch-neon-v21.png',gallery='[]'::jsonb,is_active=true WHERE slug='punch-neon-ice-30ml-v21'`,[neonDescription]);
  await c.query(`UPDATE products SET name='Punch Neon Ice 30ml',brand='PUNCH',subtitle='NEON ICE • 30 мл',description=$1,base_price=34900,image_url='/catalog-import/punch-neon-ice-v21.png',gallery='[]'::jsonb,is_active=true WHERE slug='photo-set-9102'`,[neonDescription]);
  const keep=['punch-30ml-v19','punch-neon-ice-30ml-v21','photo-set-9102'];
  await c.query('UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))=$1 AND NOT(slug=ANY($2::text[]))',['PUNCH',keep]);
  await setVariants(c,keep[0],['Apple Lemonade','Berry Lemonade','Berry Trio','Blue Razz Lemonade','Cherry Aperol','Cherry Lemonade','Citrus Blast','Dark Merry','Energy Monster','Fruit rush','Green Mix','Kiwi Lemonade','Lemongrass Chill','Love story','Mint Lemonade','Mint Tea','Mojito Lemonade','Paradise','Pear lemonade','Pink Juice','Raspberry Eden','Sherbet','Sour Berries','Tropical Lemonade','Tutti Frutti','Watermelon Fresh','X-Mint']);
  await setVariants(c,keep[1],sour);
  await setVariants(c,keep[2],ice);
  const count=(await c.query("SELECT COUNT(*)::int n FROM products WHERE UPPER(TRIM(brand))='PUNCH' AND is_active")).rows[0].n;
  if(count!==3)throw Error(`PUNCH needs 3 products, found ${count}`);
  // HYPE: one user-specified product; reuse the previous demo row so there are no extra sample products.
  const h=await c.query("SELECT id FROM products WHERE slug='hype-hard'");
  if(!h.rows.length){await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active) SELECT id,'hype-hard','Hype 30ml','HYPE','HYPE kit • 30 мл',$1,34900,'/catalog-import/product-9096.webp',true FROM categories WHERE slug='ridyny' ON CONFLICT(slug) DO NOTHING`,[hypeDescription]);}
  await c.query(`UPDATE products SET name='Hype 30ml',brand='HYPE',subtitle='HYPE kit • 30 мл',description=$1,base_price=34900,compare_at_price=NULL,image_url=CASE WHEN image_url='' THEN '/catalog-import/product-9096.webp' ELSE image_url END,is_active=true WHERE slug='hype-hard'`,[hypeDescription]);
  await c.query("UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))='HYPE' AND slug<>'hype-hard'");
  await setVariants(c,'hype-hard',hype);
  const hypeCount=(await c.query("SELECT COUNT(*)::int n FROM products WHERE UPPER(TRIM(brand))='HYPE' AND is_active")).rows[0].n;
  if(hypeCount!==1)throw Error(`Expected one Hype product, found ${hypeCount}`);
 });
 console.log('Catalog v2.3: Punch 3 products (27/10/9 flavors), Hype 1 product (20 flavors)');
}
