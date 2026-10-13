import {pool} from './db';
// Imported catalog templates: no fabricated prices, stock, or taste lists.
// Does not update existing product records or user edits.
const items = [
  {
    "slug": "photo-set-9026",
    "name": "VAPORESSO XROS — картриджі",
    "brand": "VAPORESSO",
    "category": "kartrydzhi",
    "image_url": "/catalog-import/product-9026.webp"
  },
  {
    "slug": "photo-set-9032",
    "name": "OXVA XLIM — картриджі",
    "brand": "OXVA",
    "category": "kartrydzhi",
    "image_url": "/catalog-import/product-9032.webp"
  },
  {
    "slug": "photo-set-9033",
    "name": "OXVA NeXLIM — картриджі",
    "brand": "OXVA",
    "category": "kartrydzhi",
    "image_url": "/catalog-import/product-9033.webp"
  },
  {
    "slug": "photo-set-9036",
    "name": "OXVA XLIM — колекція",
    "brand": "OXVA",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9036.webp"
  },
  {
    "slug": "photo-set-9038",
    "name": "OXVA XLIM — серія",
    "brand": "OXVA",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9038.webp"
  },
  {
    "slug": "photo-set-9041",
    "name": "OXVA XLIM — пристрої",
    "brand": "OXVA",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9041.webp"
  },
  {
    "slug": "photo-set-9042",
    "name": "OXVA XLIM — кольори",
    "brand": "OXVA",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9042.webp"
  },
  {
    "slug": "photo-set-9044",
    "name": "OXVA NeXLIM 2",
    "brand": "OXVA",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9044.webp"
  },
  {
    "slug": "photo-set-9051",
    "name": "VAPORESSO XROS MINI — колекція",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9051.webp"
  },
  {
    "slug": "photo-set-9053",
    "name": "VAPORESSO XROS MINI — кольори",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9053.webp"
  },
  {
    "slug": "photo-set-9057",
    "name": "VAPORESSO XROS 5",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9057.webp"
  },
  {
    "slug": "photo-set-9058",
    "name": "VAPORESSO XROS PRO",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9058.webp"
  },
  {
    "slug": "photo-set-9060",
    "name": "VAPORESSO XROS 5 MINI",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9060.webp"
  },
  {
    "slug": "photo-set-9062",
    "name": "VAPORESSO XROS 6",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9062.webp"
  },
  {
    "slug": "photo-set-9064",
    "name": "VAPORESSO XROS MINI 6",
    "brand": "VAPORESSO",
    "category": "pod-systemy",
    "image_url": "/catalog-import/product-9064.webp"
  },
  {
    "slug": "photo-set-9082",
    "name": "ELYZIUM LAB — колекція",
    "brand": "ELYZIUM LAB",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9082.webp"
  },
  {
    "slug": "photo-set-9085",
    "name": "MOOD DUCK — колекція",
    "brand": "MOOD",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9085.webp"
  },
  {
    "slug": "photo-set-9087",
    "name": "DUCK — асортимент смаків",
    "brand": "DUCK",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9087.webp"
  },
  {
    "slug": "photo-set-9089",
    "name": "DUCK — лінійка смаків",
    "brand": "DUCK",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9089.webp"
  },
  {
    "slug": "photo-set-9090",
    "name": "IN BOTTLE — колекція",
    "brand": "IN BOTTLE",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9090.webp"
  },
  {
    "slug": "photo-set-9091",
    "name": "CHASER LAB — асортимент",
    "brand": "CHASER",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9091.webp"
  },
  {
    "slug": "photo-set-9092",
    "name": "CHASER LAB 12ML",
    "brand": "CHASER",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9092.webp"
  },
  {
    "slug": "photo-set-9093",
    "name": "CHASER BEAT — колекція",
    "brand": "CHASER",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9093.webp"
  },
  {
    "slug": "photo-set-9094",
    "name": "CHASER — серія смаків",
    "brand": "CHASER",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9094.webp"
  },
  {
    "slug": "photo-set-9096",
    "name": "HYPE GEMS",
    "brand": "HYPE",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9096.webp"
  },
  {
    "slug": "photo-set-9097",
    "name": "HYPE — серія смаків",
    "brand": "HYPE",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9097.webp"
  },
  {
    "slug": "photo-set-9100",
    "name": "PUNCH NEON",
    "brand": "PUNCH",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9100.webp"
  },
  {
    "slug": "photo-set-9101",
    "name": "PUNCH NEON ICE",
    "brand": "PUNCH",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9101.webp"
  },
  {
    "slug": "photo-set-9102",
    "name": "PUNCH — колекція",
    "brand": "PUNCH",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9102.webp"
  },
  {
    "slug": "photo-set-9104",
    "name": "IN BOTTLE — кольорова серія",
    "brand": "IN BOTTLE",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9104.webp"
  },
  {
    "slug": "photo-set-9105",
    "name": "PUNCH — колекція смаків",
    "brand": "PUNCH",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9105.webp"
  },
  {
    "slug": "photo-set-9107",
    "name": "LUCKY — лінійка",
    "brand": "LUCKY",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9107.webp"
  },
  {
    "slug": "photo-set-9108",
    "name": "LUCKY CHROME",
    "brand": "LUCKY",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9108.webp"
  },
  {
    "slug": "photo-set-9111",
    "name": "ELFLIQ — колекція",
    "brand": "ELFLIQ",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9111.webp"
  },
  {
    "slug": "photo-set-9115",
    "name": "OCTOLAB OCTOBAR PRIME",
    "brand": "OCTOLAB",
    "category": "ridyny",
    "image_url": "/catalog-import/product-9115.webp"
  },
  {
    "slug": "photo-set-9117",
    "name": "VOOPOO VMATE Cartridge V2",
    "brand": "VOOPOO",
    "category": "kartrydzhi",
    "image_url": "/catalog-import/product-9117.webp"
  }
] as const;
export async function seedPhotoCatalog(){
  let added=0;
  for(const item of items){
    const result=await pool.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,image_url,base_price,badge,is_active)
      SELECT c.id,$2,$3,$4,'Ціна та характеристики уточнюються','Шаблонна позиція: додайте ціну, залишок, варіанти та опис в адмінпанелі.',$5,0,'',true
      FROM categories c WHERE c.slug=$1
      ON CONFLICT(slug) DO NOTHING RETURNING id`,[item.category,item.slug,item.name,item.brand,item.image_url]);
    if(result.rowCount){
      await pool.query('INSERT INTO variants(product_id,label,sku,stock,is_active) VALUES($1,$2,$3,0,true) ON CONFLICT(sku) DO NOTHING',
        [result.rows[0].id,'Уточнюється',`${item.slug}-default`]);
      added++;
    }
  }
  console.log(`Imported catalog templates: ${added} new of ${items.length} (existing left untouched)`);
}
