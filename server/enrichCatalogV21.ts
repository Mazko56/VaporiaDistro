import {tx} from './db';

const punchNeonTastes = [
  'Sour Apple','Sour Blueberry','Sour Cherry','Sour Grape','Sour Grapefruit','Sour Kiwi','Sour Lemon','Sour Lime','Sour Mandarin','Sour Orange',
  'Ice Agrus','Ice Blueberry','Ice Cactus','Ice Cherry','Ice Currant','Ice Peach','Ice Red Apple','Ice Spearmint','Ice Watermelon'
];

const punchClassicTastes = [
  'Apple Lemonade','Berry Lemonade','Berry Trio','Blue Razz Lemonade','Cherry Aperol','Cherry Lemonade','Citrus Blast','Dark Merry',
  'Energy Monster','Fruit rush','Green Mix','Kiwi Lemonade','Lemongrass Chill','Love story','Mint Lemonade','Mint Tea',
  'Mojito Lemonade','Paradise','Pear lemonade','Pink Juice','Raspberry Eden','Sherbet','Sour Berries','Tropical Lemonade','Tutti Frutti',
  'Watermelon Fresh','X-Mint'
];

const punchNeonDescription = 'PUNCH NEON 30 ML — це лінійка яскравих та насичених ароматизаторів, створена для справжніх фанатів кислих, прохолодних та фруктових смаків. Кожен флакон — це гармонійний баланс кислоти, прохолоди та соковитості, який підійде як для щоденного паріння, так і для тих, хто шукає яскраві враження.';
const punchDescription = 'Punch — сучасний бренд, що поєднує яскравий стиль, оригінальні смакові поєднання та різноманіття ароматів. Продукція бренду вирізняється впізнаваною концепцією, широким вибором смаків і увагою до деталей. Punch постійно привертає увагу поціновувачів незвичайних смакових комбінацій, пропонуючи варіанти на різні вподобання. Це бренд із власним характером, який робить акцент на індивідуальності, сучасному дизайні та різноманітті асортименту.';

const evoTastes = [
  'Banana Lemon','Berry Lemonade','Blue Razz Ice','Café Latte','Cherry Sour Apple','Cola Cherry','Cranberry Blueberry','Dragonfruit Blueberry','Forest Blackberry Menthol','Grape Energy','Grape Gummy','Lemon Black Tea','Lemon Lime','Mint','Mojito','Pineapple Peach Mango','Sour Green Apple','Sour Raspberry','Strawberry Kiwi','Tropical Punch','Vanilla Nut Tobacco','Watermelon Ice'
];
const puzzleTastes = [
  'Azia Tea','Black Cherry','Black Currant','Black Mint','Blackberry','Bubble Gum','Cactus','Cherry Juice','Cranberry','Cucumbero','DragonFruit','Dubacco','Eclipse','Energy Berry Drink','Grape Classic','Grape Concord','Kiwi Strawberry','Lemongrass','Lime Lemonade','Mixed Berries','Orange','Peach','Pineapple','Pineapple Peach','Pink Berry','Pomelo','Red Apple','Red Soda','Sakura','Spearmint','Watermelon'
];

function slugify(input:string){
  return input.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function normalizeLabel(input:string){
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[🍓🍒🍏🍇🍋🧊☕🌿🍑🍎🥝🍍🍉🍊🥭🥥🥤🫐❄️⚡️⚡⭐️⭐🔥]/g,'')
    .replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ]+/g,' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g,' ');
}

async function syncExactVariants(c:any, productId:number, productSlug:string, tastes:string[], stock=25){
  const existing = (await c.query('SELECT id,label,sku,stock,is_active FROM variants WHERE product_id=$1 ORDER BY id ASC',[productId])).rows;
  const groups = new Map<string, any[]>();
  for (const row of existing) {
    const key = normalizeLabel(row.label);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const usedIds = new Set<number>();

  for (const taste of tastes) {
    const key = normalizeLabel(taste);
    const matches = (groups.get(key) || []).filter((row:any)=>!usedIds.has(row.id));
    const chosen = matches[0] || null;
    const sku = `${productSlug}-taste-${slugify(taste)}`;
    if (chosen) {
      usedIds.add(chosen.id);
      await c.query(`UPDATE variants
        SET label=$1, sku=$2, stock=GREATEST(stock,$3), is_active=true
        WHERE id=$4`, [taste, sku, stock, chosen.id]);
    } else {
      await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
        VALUES($1,$2,$3,$4,true)
        ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label, stock=GREATEST(variants.stock,$4), is_active=true`, [productId, taste, sku, stock]);
      const inserted = await c.query('SELECT id FROM variants WHERE sku=$1',[sku]);
      if (inserted.rows[0]?.id) usedIds.add(inserted.rows[0].id);
    }
  }

  for (const row of existing) {
    if (!usedIds.has(row.id)) {
      await c.query('UPDATE variants SET is_active=false, stock=0 WHERE id=$1',[row.id]);
    }
  }
}

async function upsertProduct(c:any, slug:string, name:string, brand:string, subtitle:string, description:string, imageUrl:string, gallery:string[], basePrice:number){
  await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,compare_at_price,image_url,gallery,is_active)
    SELECT id,$1,$2,$3,$4,$5,$6,NULL,$7,$8::jsonb,true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`, [slug,name,brand,subtitle,description,basePrice,imageUrl,JSON.stringify(gallery)]);
  await c.query(`UPDATE products
    SET name=$1, brand=$2, subtitle=$3, description=$4, base_price=$5, compare_at_price=NULL,
        image_url=$6, gallery=$7::jsonb, is_active=true
    WHERE slug=$8`, [name,brand,subtitle,description,basePrice,imageUrl,JSON.stringify(gallery),slug]);
  return (await c.query('SELECT id FROM products WHERE slug=$1',[slug])).rows[0]?.id as number | undefined;
}

export async function enrichCatalogV21(){
  await tx(async c=>{
    await c.query(`CREATE TABLE IF NOT EXISTS catalog_content_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const lock = await c.query(`INSERT INTO catalog_content_versions(version) VALUES('v2.1-inbottle-punch-fix') ON CONFLICT DO NOTHING RETURNING version`);
    if(!lock.rowCount) return;

    // Clean IN BOTTLE variants: keep only one active set per taste and hide stale duplicates.
    const evo = await c.query(`SELECT id FROM products WHERE slug='inbottle-evo'`);
    if (evo.rows.length) await syncExactVariants(c, evo.rows[0].id, 'inbottle-evo', evoTastes);
    const puzzle = await c.query(`SELECT id FROM products WHERE slug='inbottle-puzzle-30ml-v19'`);
    if (puzzle.rows.length) await syncExactVariants(c, puzzle.rows[0].id, 'inbottle-puzzle-30ml-v19', puzzleTastes);

    // Keep only the real Punch assortment products active for now.
    await c.query(`UPDATE products SET is_active=false WHERE UPPER(brand)='PUNCH' AND slug NOT IN ('punch-30ml-v19','punch-neon-ice-30ml-v21')`);

    const punchNeonId = await upsertProduct(
      c,
      'punch-neon-ice-30ml-v21',
      'Punch Neon/Ice 30ml',
      'PUNCH',
      'NEON / ICE • 30 мл',
      punchNeonDescription,
      '/catalog-import/punch-neon-v21.png',
      ['/catalog-import/punch-neon-ice-v21.png'],
      34900,
    );
    if (punchNeonId) await syncExactVariants(c, punchNeonId, 'punch-neon-ice-30ml-v21', punchNeonTastes);

    const punchId = await upsertProduct(
      c,
      'punch-30ml-v19',
      'Punch 30ml',
      'PUNCH',
      'Колекція смаків • 30 мл',
      punchDescription,
      '/catalog-import/punch-30-v21.png',
      [],
      34900,
    );
    if (punchId) await syncExactVariants(c, punchId, 'punch-30ml-v19', punchClassicTastes);
  });
  console.log('Catalog enrichment v2.1 applied or already present');
}
