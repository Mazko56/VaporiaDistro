import {tx} from './db';

const luckyFlavors = [
  'Blueberry Blackcurrant', 'Forest Berry Mint', 'Green Apple Lychee', 'Green Tea',
  'Gummy Bears', 'Peach Gooseberry', 'Pomegranate Cherry', 'Raspberry',
  'Summer Tea', 'Tropical'
];
const mintFlavors = ['Menthol','Cranberry Mint','Bilberry Mint','Sweet Mint','Peppermint','Bubble Mint'];
const luckyDescription = `Lucky Chrome — яскрава лінійка рідин для тих, хто обожнює насичені смаки та сміливі поєднання! Соковиті ягоди, стиглі фрукти, освіжаюча м’ята, ароматний чай і тропічні ноти — кожен варіант дарує яскраві враження та власний характер.\n\nВідчуйте гармонійний баланс солодкості, легкої кислинки й свіжості, насолоджуючись виразним ароматом і насиченим смаком у кожній затяжці. Обирайте свій фаворит і спробуйте всю лінійку Lucky Chrome вже сьогодні!`;
const mintDescription = 'Chaser My Mint — освіжаюча лінійка від українського бренду Chaser Lab, присвячена м’ятним смакам. Від ніжної солодкої м’яти до насиченого ментолу та ягідно-м’ятних поєднань. Кожен смак має власний характер та різну інтенсивність прохолоди.';

const brandOrders: [string,string[]][] = [
 ['CHASER',['photo-set-9094','chaser-lux-ultra-30ml-v19','chaser-my-mint-12ml-v341','photo-set-9093']],
 ['VAPORESSO',['photo-set-9062','photo-set-9064','photo-set-9057','photo-set-9060','photo-set-9058','photo-set-9053','photo-set-9051','photo-set-9026']],
 ['OXVA',['oxva-xlim-pro-3-v19','photo-set-9044','oxva-nexlim-2-mini-v19','oxva-xlim-go-2-v19','oxva-xlim-go-lite-v19','photo-set-9032','photo-set-9033']],
 ['LUCKY',['lucky-30ml-v20','lucky-chrome-30ml-v341']],
 ['PUNCH',['punch-30ml-v19','punch-neon-ice-30ml-v21','photo-set-9102']],
 ['HYPE',['hype-hard','hype-gems-30ml']],
 ['MOOD',['photo-set-9087','photo-set-9085']],
 ['DUCK',['photo-set-9089']]
];
const categoryOrders: [string,string[]][] = [
 ['pod-systemy',[
  'photo-set-9062','photo-set-9064','photo-set-9057','photo-set-9060','photo-set-9058','photo-set-9053','photo-set-9051',
  'oxva-xlim-pro-3-v19','photo-set-9044','oxva-nexlim-2-mini-v19','oxva-xlim-go-2-v19','oxva-xlim-go-lite-v19'
 ]],
 ['ridyny',[
  'photo-set-9094','chaser-lux-ultra-30ml-v19','chaser-my-mint-12ml-v341','photo-set-9093',
  'lucky-30ml-v20','lucky-chrome-30ml-v341',
  'punch-30ml-v19','punch-neon-ice-30ml-v21','photo-set-9102',
  'hype-hard','hype-gems-30ml','photo-set-9087','photo-set-9089','photo-set-9085'
 ]],
 ['kartrydzhi',['photo-set-9026','photo-set-9032','photo-set-9033','photo-set-9117']]
];

async function reorder(c:any, column:'brand_position'|'category_position', groupColumn:'brand'|'category_id', groupValue:string|number, slugs:string[]){
  const all=(await c.query(`SELECT id,slug FROM products WHERE ${groupColumn}=$1 AND is_active=true ORDER BY ${column} ASC NULLS LAST,created_at DESC,id DESC FOR UPDATE`,[groupValue])).rows;
  const slugsMap=new Map<string,number>(all.map((r:{id:number;slug:string})=>[r.slug,r.id]));
  const selected=new Set(slugs);
  const ids=[...slugs.map(slug=>slugsMap.get(slug)).filter((id):id is number=>typeof id==='number'),...all.filter((r:{slug:string})=>!selected.has(r.slug)).map((r:{id:number})=>r.id)];
  for(let i=0;i<ids.length;i++)await c.query(`UPDATE products SET ${column}=$1 WHERE id=$2 AND ${column} IS DISTINCT FROM $1`,[i+1,ids[i]]);
}

export async function enrichCatalogV341(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const marker=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v3.3.11-lucky-chrome-chaser-mint-order') ON CONFLICT DO NOTHING RETURNING version");
  if(!marker.rowCount)return;
  // Data applies once: do not reset admin order edits or stock on future Railway redeploys.
  const additions=[
   {slug:'lucky-chrome-30ml-v341',name:'LUCKY CHROME 30ml',brand:'LUCKY',subtitle:'CHROME • 30 мл',description:luckyDescription,image:'/catalog-import/lucky-chrome-30ml-v341.webp',flavors:luckyFlavors},
   {slug:'chaser-my-mint-12ml-v341',name:'Chaser My Mint 12ml',brand:'CHASER',subtitle:'MY MINT • 12 мл',description:mintDescription,image:'/catalog-import/chaser-my-mint-12ml-v341.webp',flavors:mintFlavors}
  ];
  for(const p of additions){
   await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,badge,is_active)
    SELECT id,$1,$2,$3,$4,$5,34900,$6,'НОВИНКА',true FROM categories WHERE slug='ridyny'
    ON CONFLICT(slug) DO NOTHING`,[p.slug,p.name,p.brand,p.subtitle,p.description,p.image]);
   const product=(await c.query('SELECT id FROM products WHERE slug=$1',[p.slug])).rows[0];
   if(!product)throw new Error(`Missing product ${p.slug}`);
   for(let i=0;i<p.flavors.length;i++){
    await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active) VALUES($1,$2,$3,100,true)
      ON CONFLICT(sku) DO NOTHING`,[product.id,p.flavors[i],`${p.slug}-${i+1}`]);
   }
  }
  for(const [brand,slugs] of brandOrders)await reorder(c,'brand_position','brand',brand,slugs);
  for(const [slug,slugs] of categoryOrders){
   const category=(await c.query('SELECT id FROM categories WHERE slug=$1',[slug])).rows[0];
   if(category)await reorder(c,'category_position','category_id',category.id,slugs);
  }
 });
 console.log('Catalog v3.3.11: Lucky Chrome, Chaser My Mint and initial positions applied');
}
