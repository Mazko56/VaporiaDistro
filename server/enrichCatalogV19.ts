import {pool,tx} from './db';
// One-off catalog enrichment; idempotent and safe across Railway restarts.
// No stock is invented. Existing manual photo edits are not replaced.
const evoTastes = ["Banana Lemon", "Berry Lemonade", "Blue Razz Ice", "Café Latte", "Cherry Sour Apple", "Cola Cherry", "Cranberry Blueberry", "Dragonfruit Blueberry", "Forest Blackberry Menthol", "Grape Energy", "Grape Gummy", "Lemon Black Tea", "Lemon Lime", "Mint", "Mojito", "Pineapple Peach Mango", "Sour Green Apple", "Sour Raspberry", "Strawberry Kiwi", "Tropical Punch", "Vanilla Nut Tobacco", "Watermelon Ice"];
const puzzleTastes = ["Azia Tea", "Black Cherry", "Black Currant", "Black Mint", "Blackberry", "Bubble Gum", "Cactus", "Cherry Juice", "Cranberry", "Cucumbero", "DragonFruit", "Dubacco", "Eclipse", "Energy Berry Drink", "Grape Classic", "Grape Concord", "Kiwi Strawberry", "Lemongrass", "Lime Lemonade", "Mixed Berries", "Orange", "Peach", "Pineapple", "Pineapple Peach", "Pink Berry", "Pomelo", "Red Apple", "Red Soda", "Sakura", "Spearmint", "Watermelon"];
const prices:Record<string,number> = {"photo-set-9026": 120, "photo-set-9032": 150, "photo-set-9033": 150, "photo-set-9117": 130, "photo-set-9051": 649, "photo-set-9053": 749, "photo-set-9058": 1190, "photo-set-9057": 1199, "photo-set-9060": 849, "photo-set-9062": 1299, "photo-set-9064": 899, "photo-set-9044": 1399, "photo-set-9091": 300, "photo-set-9092": 300, "photo-set-9093": 349, "photo-set-9094": 349, "photo-set-9085": 149, "photo-set-9087": 349, "photo-set-9089": 349, "photo-set-9115": 349, "photo-set-9100": 349, "photo-set-9101": 349, "photo-set-9102": 349, "photo-set-9105": 349, "photo-set-9096": 349, "photo-set-9097": 349, "photo-set-9104": 349, "photo-set-9107": 349, "photo-set-9108": 349, "photo-set-9090": 300, "inbottle-evo": 349, "chaser-beat": 349, "hype-hard": 349, "vaporesso-xros-6": 1299, "vaporesso-xros-6-mini": 899, "xros-cartridge": 120};
const corrections:Record<string,[string,string]> = {"photo-set-9104": ["IN BOTTLE EVO 30ml", "IN BOTTLE"], "photo-set-9090": ["CHASER — колекція смаків", "CHASER"], "photo-set-9051": ["VAPORESSO XROS MINI", "VAPORESSO"], "photo-set-9053": ["VAPORESSO XROS MINI — кольори", "VAPORESSO"]};
const newProducts:[string,string,string,string,number][] = [["vaporesso-xros-pro-v19", "VAPORESSO XROS PRO", "VAPORESSO", "pod-systemy", 1190], ["vaporesso-xros-3-mini-v19", "VAPORESSO XROS 3 MINI", "VAPORESSO", "pod-systemy", 749], ["oxva-xlim-go-2-v19", "OXVA XLIM GO 2", "OXVA", "pod-systemy", 599], ["oxva-xlim-go-lite-v19", "OXVA XLIM GO LITE", "OXVA", "pod-systemy", 499], ["oxva-xlim-pro-3-v19", "OXVA XLIM PRO 3", "OXVA", "pod-systemy", 1349], ["oxva-nexlim-2-mini-v19", "OXVA NeXLIM 2 MINI", "OXVA", "pod-systemy", 829], ["inbottle-puzzle-30ml-v19", "IN BOTTLE PUZZLE 30ml", "IN BOTTLE", "ridyny", 349], ["chaser-lux-ultra-30ml-v19", "CHASER LUX ULTRA 30ml", "CHASER", "ridyny", 349], ["quack-attack-30ml-v19", "QUACK ATTACK 30ml", "DUCK", "ridyny", 349], ["punch-30ml-v19", "PUNCH 30ml", "PUNCH", "ridyny", 349]];
const evoDescription="In Bottle Evo — лінійка наборів для сольового самозамісу від малайзійського виробника In Bottle, який з 2016 року спеціалізується на насичених та вишуканих смакових композиціях для POD-систем. Лінійка Evo поєднує фруктові, ягідні, десертні, напійні, тютюнові та холодні мікси.";
const puzzleDescription="In Bottle — ідеальний продукт для щоденного вейпінгу, який забезпечує швидке та смачне насичення стриманими натуральними смаками. Ця лінійка рідин представляє преміум-сегмент малайзійського виробництва. Смакова палітра включає ряд різноманітних фруктових, ягідних і десертних смаків, а рідини надзвичайно насичені та ідеально збалансовані.";
export async function enrichCatalogV19() {
 await tx(async c=>{
  await c.query(`CREATE TABLE IF NOT EXISTS catalog_content_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const lock=await c.query(`INSERT INTO catalog_content_versions(version) VALUES('v1.9-products-prices-tastes') ON CONFLICT DO NOTHING RETURNING version`);
  if(!lock.rowCount)return;
  for(const [slug,amount] of Object.entries(prices)) {
    // Imported templates have zero prices. Seed demo prices are only overwritten if known unedited values.
    const oldDemo:Record<string,number>={'inbottle-evo':35000,'chaser-beat':30000,'hype-hard':32000,'vaporesso-xros-6':130000,'vaporesso-xros-6-mini':91000,'xros-cartridge':16000};
    const expected=oldDemo[slug]??0;
    await c.query('UPDATE products SET base_price=$2,compare_at_price=NULL WHERE slug=$1 AND base_price=$3',[slug,amount*100,expected]);
  }
  for(const [slug,[name,brand]] of Object.entries(corrections)) {
    const old=slug==='photo-set-9090'?'IN BOTTLE — колекція':slug==='photo-set-9104'?'IN BOTTLE — кольорова серія':null;
    if(old)await c.query('UPDATE products SET name=$2,brand=$3 WHERE slug=$1 AND name=$4',[slug,name,brand,old]);
  }
  // Create only absent catalog models, without guessing their image, flavor availability or stock.
  for(const [slug,name,brand,category,price] of newProducts) {
    const result=await c.query(`INSERT INTO products(category_id,slug,name,brand,description,base_price,image_url) SELECT id,$2,$3,$4,'Характеристики та фото уточнюються.',$5,'' FROM categories WHERE slug=$1 ON CONFLICT(slug) DO NOTHING RETURNING id`,[category,slug,name,brand,price*100]);
    if(result.rows.length)await c.query('INSERT INTO variants(product_id,label,sku,stock) VALUES($1,$2,$3,0) ON CONFLICT(sku) DO NOTHING',[result.rows[0].id,'Варіант уточнюється',slug+'-default']);
  }
  // The original InBottle demo and the imported EVO photo can both exist. Keep both records,
  // but show their respective copy and tastes; never overwrite edited images.
  for(const slug of ['photo-set-9104','inbottle-evo']) {
    const found=await c.query('SELECT id,description FROM products WHERE slug=$1',[slug]);
    if(!found.rows.length)continue;
    const product=found.rows[0];
    if(slug==='photo-set-9104')await c.query('UPDATE products SET description=$2,subtitle=$3 WHERE id=$1 AND description LIKE $4',[product.id,evoDescription,'EVO • 30 мл','Шаблонна позиція:%']);
    else await c.query('UPDATE products SET description=$2 WHERE id=$1 AND description LIKE $3',[product.id,evoDescription,'Демонстраційна картка%']);
    const variants=await c.query('SELECT id,label,stock FROM variants WHERE product_id=$1',[product.id]);
    if(variants.rows.every(v=>v.stock===0 || slug==='inbottle-evo')){
      // Preserve existing variant rows referenced by carts/orders, and any stock >0.
      for(let i=0;i<evoTastes.length;i++)await c.query('INSERT INTO variants(product_id,label,sku,stock) VALUES($1,$2,$3,0) ON CONFLICT(sku) DO NOTHING',[product.id,evoTastes[i],slug+'-taste-'+(i+1)]);
      await c.query(`UPDATE variants SET is_active=false WHERE product_id=$1 AND label='Уточнюється' AND stock=0`,[product.id]);
    }
  }
  const puzzle=await c.query('SELECT id,description FROM products WHERE slug=$1',['inbottle-puzzle-30ml-v19']);
  if(puzzle.rows.length) {
    const id=puzzle.rows[0].id;
    await c.query('UPDATE products SET description=$2,subtitle=$3 WHERE id=$1 AND description=$4',[id,puzzleDescription,'PUZZLE • 30 мл','Характеристики та фото уточнюються.']);
    for(let i=0;i<puzzleTastes.length;i++)await c.query('INSERT INTO variants(product_id,label,sku,stock) VALUES($1,$2,$3,0) ON CONFLICT(sku) DO NOTHING',[id,puzzleTastes[i],'inbottle-puzzle-30ml-v19-taste-'+(i+1)]);
    await c.query(`UPDATE variants SET is_active=false WHERE product_id=$1 AND label='Варіант уточнюється' AND stock=0`,[id]);
  }
 });
 console.log('Catalog enrichment v1.9 applied or already present');
}
