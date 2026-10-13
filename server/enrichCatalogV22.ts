import {tx} from './db';

// One-time correction for databases which have already applied v2.0 and v2.1.
// Preserve original variant IDs and SKU values for orders and carts.
const evo = ['Banana Lemon','Berry Lemonade','Blue Razz Ice','Café Latte','Cherry Sour Apple','Cola Cherry','Cranberry Blueberry','Dragonfruit Blueberry','Forest Blackberry Menthol','Grape Energy','Grape Gummy','Lemon Black Tea','Lemon Lime','Mint','Mojito','Pineapple Peach Mango','Sour Green Apple','Sour Raspberry','Strawberry Kiwi','Tropical Punch','Vanilla Nut Tobacco','Watermelon Ice'];
const puzzle = ['Azia Tea','Black Cherry','Black Currant','Black Mint','Blackberry','Bubble Gum','Cactus','Cherry Juice','Cranberry','Cucumbero','DragonFruit','Dubacco','Eclipse','Energy Berry Drink','Grape Classic','Grape Concord','Kiwi Strawberry','Lemongrass','Lime Lemonade','Mixed Berries','Orange','Peach','Pineapple','Pineapple Peach','Pink Berry','Pomelo','Red Apple','Red Soda','Sakura','Spearmint','Watermelon'];
const neon = ['Sour Apple','Sour Blueberry','Sour Cherry','Sour Grape','Sour Grapefruit','Sour Kiwi','Sour Lemon','Sour Lime','Sour Mandarin','Sour Orange','Ice Agrus','Ice Blueberry','Ice Cactus','Ice Cherry','Ice Currant','Ice Peach','Ice Red Apple','Ice Spearmint','Ice Watermelon'];
const classic = ['Apple Lemonade','Berry Lemonade','Berry Trio','Blue Razz Lemonade','Cherry Aperol','Cherry Lemonade','Citrus Blast','Dark Merry','Energy Monster','Fruit rush','Green Mix','Kiwi Lemonade','Lemongrass Chill','Love story','Mint Lemonade','Mint Tea','Mojito Lemonade','Paradise','Pear lemonade','Pink Juice','Raspberry Eden','Sherbet','Sour Berries','Tropical Lemonade','Tutti Frutti','Watermelon Fresh','X-Mint'];
const neonDescription = 'PUNCH NEON 30 ML — це лінійка яскравих та насичених ароматизаторів, створена для справжніх фанатів кислих, прохолодних та фруктових смаків. Кожен флакон — це гармонійний баланс кислоти, прохолоди та соковитості, який підійде як для щоденного паріння, так і для тих, хто шукає яскраві враження.';
const classicDescription = 'Punch — сучасний бренд, що поєднує яскравий стиль, оригінальні смакові поєднання та різноманіття ароматів. Продукція бренду вирізняється впізнаваною концепцією, широким вибором смаків і увагою до деталей. Punch постійно привертає увагу поціновувачів незвичайних смакових комбінацій, пропонуючи варіанти на різні вподобання. Це бренд із власним характером, який робить акцент на індивідуальності, сучасному дизайні та різноманітті асортименту.';

function norm(s:string){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яіїєґ]+/giu,'').toLowerCase();}
async function replaceFlavors(c:any,slug:string,flavors:string[]){
 const result = await c.query('SELECT id FROM products WHERE slug=$1',[slug]);
 if(!result.rows.length)throw new Error(`Catalog product missing: ${slug}`);
 const id=result.rows[0].id;
 const rows=(await c.query('SELECT id,label,stock,is_active FROM variants WHERE product_id=$1 ORDER BY id',[id])).rows;
 const taken=new Set<number>();
 for(let i=0;i<flavors.length;i++){
  const label=flavors[i];
  // Prefer original flavor rows (often crossed out) over later import-generated duplicates.
  const candidate=rows.find((r:any)=>!taken.has(r.id)&&norm(r.label)===norm(label));
  if(candidate){
    taken.add(candidate.id);
    await c.query('UPDATE variants SET label=$1,is_active=true,stock=GREATEST(stock,25) WHERE id=$2',[label,candidate.id]);
  }else{
    const sku=`v22-${slug}-${i+1}`;
    const inserted=await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active) VALUES($1,$2,$3,25,true)
      ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,is_active=true,stock=GREATEST(variants.stock,25) RETURNING id`,[id,label,sku]);
    taken.add(inserted.rows[0].id);
  }
 }
 // Hide obsolete rows; retain IDs to avoid changing existing cart/order references.
 for(const row of rows){if(!taken.has(row.id))await c.query('UPDATE variants SET is_active=false WHERE id=$1',[row.id]);}
 const counts=await c.query('SELECT count(*)::int AS n FROM variants WHERE product_id=$1 AND is_active',[id]);
 if(counts.rows[0].n!==flavors.length)throw new Error(`Wrong active flavor count for ${slug}`);
}
export async function enrichCatalogV22(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const once=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.2-punch-inbottle-strict') ON CONFLICT DO NOTHING RETURNING version");
  if(!once.rowCount)return;
  await replaceFlavors(c,'inbottle-evo',evo);
  await replaceFlavors(c,'inbottle-puzzle-30ml-v19',puzzle);
  // Ensure the two new named products exist, even when the older v2.1 code never ran.
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,'punch-neon-ice-30ml-v21','Punch Neon/Ice 30ml','PUNCH','NEON / ICE • 30 мл',$1,34900,'/catalog-import/punch-neon-v21.png',true
    FROM categories WHERE slug='ridyny' ON CONFLICT(slug) DO NOTHING`,[neonDescription]);
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,'punch-30ml-v19','Punch 30ml','PUNCH','30 мл',$1,34900,'/catalog-import/punch-30-v21.png',true
    FROM categories WHERE slug='ridyny' ON CONFLICT(slug) DO NOTHING`,[classicDescription]);
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,'photo-set-9102','Punch','PUNCH','30 мл',$1,34900,'/catalog-import/product-9102.webp',true
    FROM categories WHERE slug='ridyny' ON CONFLICT(slug) DO NOTHING`,[classicDescription]);
  // Exactly three Punch positions as requested: Neon/Ice, Punch 30ml, Punch (previously 'Punch — колекція').
  const keep=['punch-neon-ice-30ml-v21','punch-30ml-v19','photo-set-9102'];
  await c.query('UPDATE products SET is_active=false WHERE UPPER(TRIM(brand))=$1 AND NOT (slug=ANY($2::text[]))',['PUNCH',keep]);
  await c.query(`UPDATE products SET name='Punch Neon/Ice 30ml',brand='PUNCH',description=$1,base_price=34900,
    image_url='/catalog-import/punch-neon-v21.png',gallery=$2::jsonb,is_active=true WHERE slug='punch-neon-ice-30ml-v21'`,
    [neonDescription,JSON.stringify(['/catalog-import/punch-neon-ice-v21.png'])]);
  await c.query(`UPDATE products SET name='Punch 30ml',brand='PUNCH',description=$1,base_price=34900,
    image_url='/catalog-import/punch-30-v21.png',is_active=true WHERE slug='punch-30ml-v19'`,[classicDescription]);
  await c.query(`UPDATE products SET name='Punch',brand='PUNCH',subtitle='30 мл',description=$1,base_price=34900,
    is_active=true WHERE slug='photo-set-9102'`,[classicDescription]);
  await replaceFlavors(c,keep[0],neon);
  await replaceFlavors(c,keep[1],classic);
  await replaceFlavors(c,keep[2],classic);
  const p=await c.query('SELECT count(*)::int AS n FROM products WHERE UPPER(TRIM(brand))=$1 AND is_active',['PUNCH']);
  if(p.rows[0].n!==3)throw new Error(`Expected 3 Punch products, found ${p.rows[0].n}`);
 });
 console.log('Catalog enrichment v2.2: 3 Punch products; EVO 22, PUZZLE 31, Neon 19, Punch 27 flavors');
}
