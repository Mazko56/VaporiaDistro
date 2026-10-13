import {tx} from './db';

const evoTastes = [
  'Banana Lemon','Berry Lemonade','Blue Razz Ice','Café Latte','Cherry Sour Apple','Cola Cherry','Cranberry Blueberry','Dragonfruit Blueberry','Forest Blackberry Menthol','Grape Energy','Grape Gummy','Lemon Black Tea','Lemon Lime','Mint','Mojito','Pineapple Peach Mango','Sour Green Apple','Sour Raspberry','Strawberry Kiwi','Tropical Punch','Vanilla Nut Tobacco','Watermelon Ice'
];
const puzzleTastes = [
  'Azia Tea','Black Cherry','Black Currant','Black Mint','Blackberry','Bubble Gum','Cactus','Cherry Juice','Cranberry','Cucumbero','DragonFruit','Dubacco','Eclipse','Energy Berry Drink','Grape Classic','Grape Concord','Kiwi Strawberry','Lemongrass','Lime Lemonade','Mixed Berries','Orange','Peach','Pineapple','Pineapple Peach','Pink Berry','Pomelo','Red Apple','Red Soda','Sakura','Spearmint','Watermelon'
];
const luckyTastes = [
  'Apple','Banana','Berry Lemonade','Blue Razz','Blueberry','Blueberry Lemonade','Cactus Guava Kiwi','Cherry Lemonade','Coconut Melon','Cola Lemonade','Cold Mango','Gold Kiwi Strawberry','Grape','Grapefruit','Green Tea Lemonade','Juicy Peach','Lemon Lime Lemonade','Mojito Lemonade','Mokko','Orange Lemonade','Pear','Pink Lemonade','Sour Pineapple Menthol','Spearmint','Strawberry','Watermelon Lemonade','Wild Berries'
];

const evoDescription = 'In Bottle Evo — лінійка наборів для сольового самозамісу від малайзійського виробника In Bottle, який з 2016 року спеціалізується на насичених та вишуканих смакових композиціях для POD-систем. Лінійка Evo поєднує фруктові, ягідні, десертні, напійні, тютюнові та холодні мікси.';
const puzzleDescription = 'In Bottle — ідеальний продукт для щоденного вейпінгу, який забезпечує швидке та смачне насичення стриманими натуральними смаками. Ця лінійка рідин представляє преміум-сегмент малайзійського виробництва. Смакова палітра включає ряд різноманітних фруктових, ягідних і десертних смаків, а рідини надзвичайно насичені та ідеально збалансовані.';
const luckyDescription = 'Lucky — це лінійка, яку часто беруть не «на раз спробувати», а під стабільний щоденний сценарій: коли хочеться зрозумілого смаку, прогнозованої подачі та мінімуму сюрпризів у pod-системі.';

async function upsertVariants(c:any, productId:number, productSlug:string, tastes:string[], stock=25){
  const existing = await c.query('SELECT id,label,sku FROM variants WHERE product_id=$1',[productId]);
  const allowed = new Set(tastes);
  for (const label of tastes) {
    const sku = `${productSlug}-taste-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}`;
    await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
      VALUES($1,$2,$3,$4,true)
      ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label, stock=GREATEST(variants.stock,$4), is_active=true`,[productId,label,sku,stock]);
  }
  for (const row of existing.rows) {
    if (!allowed.has(row.label)) {
      await c.query('UPDATE variants SET is_active=false, stock=0 WHERE id=$1',[row.id]);
    }
  }
}

export async function enrichCatalogV20(){
  await tx(async c=>{
    await c.query(`CREATE TABLE IF NOT EXISTS catalog_content_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const lock = await c.query(`INSERT INTO catalog_content_versions(version) VALUES('v2.0-inbottle-lucky-cleanup') ON CONFLICT DO NOTHING RETURNING version`);
    if(!lock.rowCount) return;

    // Keep only two active IN BOTTLE products.
    await c.query(`UPDATE products SET is_active=false WHERE UPPER(brand) IN ('IN BOTTLE','INBOTTLE') AND slug NOT IN ('inbottle-evo','inbottle-puzzle-30ml-v19')`);

    // EVO
    await c.query(`UPDATE products
      SET name='In bottle Evo 30ml', brand='IN BOTTLE', subtitle='EVO • 30 мл',
          description=$2, base_price=34900, compare_at_price=NULL,
          image_url='/catalog-import/inbottle-evo-v20.png', is_active=true
      WHERE slug='inbottle-evo'`, ['inbottle-evo', evoDescription]);
    const evo = await c.query(`SELECT id FROM products WHERE slug='inbottle-evo'`);
    if (evo.rows.length) await upsertVariants(c, evo.rows[0].id, 'inbottle-evo', evoTastes);

    // PUZZLE
    const puzzleInsert = await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,compare_at_price,image_url,is_active)
      SELECT id,'inbottle-puzzle-30ml-v19','In bottle Puzzle 30ml','IN BOTTLE','PUZZLE • 30 мл',$2,34900,NULL,'/catalog-import/inbottle-puzzle-v20.png',true FROM categories WHERE slug='ridyny'
      ON CONFLICT(slug) DO NOTHING RETURNING id`, ['ridyny', puzzleDescription]);
    await c.query(`UPDATE products
      SET name='In bottle Puzzle 30ml', brand='IN BOTTLE', subtitle='PUZZLE • 30 мл',
          description=$2, base_price=34900, compare_at_price=NULL,
          image_url='/catalog-import/inbottle-puzzle-v20.png', is_active=true
      WHERE slug='inbottle-puzzle-30ml-v19'`, ['inbottle-puzzle-30ml-v19', puzzleDescription]);
    const puzzle = await c.query(`SELECT id FROM products WHERE slug='inbottle-puzzle-30ml-v19'`);
    if (puzzle.rows.length) await upsertVariants(c, puzzle.rows[0].id, 'inbottle-puzzle-30ml-v19', puzzleTastes);

    // Lucky: use a single clean product.
    await c.query(`UPDATE products SET is_active=false WHERE brand='LUCKY' AND slug<>'lucky-30ml-v20'`);
    await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,compare_at_price,image_url,is_active)
      SELECT id,'lucky-30ml-v20','Lucky 30ml','LUCKY','Стабільна лінійка • 30 мл',$2,34900,NULL,'/catalog-import/product-9107.webp',true FROM categories WHERE slug='ridyny'
      ON CONFLICT(slug) DO NOTHING`, ['ridyny', luckyDescription]);
    await c.query(`UPDATE products
      SET name='Lucky 30ml', brand='LUCKY', subtitle='Стабільна лінійка • 30 мл',
          description=$2, base_price=34900, compare_at_price=NULL,
          image_url=COALESCE(NULLIF(image_url,''),'/catalog-import/product-9107.webp'), is_active=true
      WHERE slug='lucky-30ml-v20'`, ['lucky-30ml-v20', luckyDescription]);
    const lucky = await c.query(`SELECT id FROM products WHERE slug='lucky-30ml-v20'`);
    if (lucky.rows.length) await upsertVariants(c, lucky.rows[0].id, 'lucky-30ml-v20', luckyTastes);
  });
  console.log('Catalog enrichment v2.0 applied or already present');
}
