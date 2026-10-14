import {tx} from './db';

type Item={slug:string;name:string;brand:string;price:number;image:string;volumes?:string[];resistances?:string[]};
const products:Item[]=[
 {slug:'photo-set-9026',name:'VAPORESSO XROS — картриджі',brand:'VAPORESSO',price:12000,image:'/catalog-import/product-9026.webp',volumes:['2 мл','3 мл'],resistances:['0.4 Ω','0.6 Ω','0.8 Ω','1.0 Ω','1.2 Ω']},
 {slug:'photo-set-9032',name:'OXVA XLIM — картриджі',brand:'OXVA',price:15000,image:'/catalog-import/product-9032.webp',volumes:['2 мл','3 мл'],resistances:['0.4 Ω','0.6 Ω','0.8 Ω','1.2 Ω']},
 {slug:'photo-set-9033',name:'OXVA NeXLIM — картриджі',brand:'OXVA',price:15000,image:'/catalog-import/product-9033.webp',volumes:['2 мл','4 мл'],resistances:['0.6 Ω','0.8 Ω']},
 {slug:'photo-set-9117',name:'VOOPOO VMATE — картриджі',brand:'VOOPOO',price:13000,image:'/catalog-import/product-9117.webp'}
];

export async function enrichCatalogV29(){
 await tx(async c=>{
  await c.query('CREATE TABLE IF NOT EXISTS catalog_content_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const applied=await c.query("INSERT INTO catalog_content_versions(version) VALUES('v2.9-cartridges') ON CONFLICT DO NOTHING RETURNING version");
  if(!applied.rowCount)return;
  for(const product of products){
   const labels=product.volumes && product.resistances ? product.volumes.flatMap(volume=>product.resistances!.map(ohm=>`${volume} / ${ohm}`)) : ['Стандартний варіант'];
   const description=product.volumes && product.resistances
    ? `Змінні картриджі ${product.brand}. Оберіть об’єм і опір із доступних варіантів.`
    : 'Змінні картриджі VOOPOO VMATE. Конкретний об’єм і опір будуть додані після уточнення асортименту.';
   await c.query(`INSERT INTO products(category_id,slug,name,brand,subtitle,description,base_price,image_url,is_active)
    SELECT id,$1,$2,$3,'Змінні картриджі',$4,$5,$6,true FROM categories WHERE slug='kartrydzhi'
    ON CONFLICT(slug) DO NOTHING`,[product.slug,product.name,product.brand,description,product.price,product.image]);
   await c.query(`UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='kartrydzhi'),name=$1,brand=$2,subtitle='Змінні картриджі',description=$3,base_price=$4,compare_at_price=NULL,image_url=$5,is_active=true WHERE slug=$6`,[product.name,product.brand,description,product.price,product.image,product.slug]);
   const p=(await c.query('SELECT id FROM products WHERE slug=$1',[product.slug])).rows[0];
   if(!p)throw Error(`Cartridge product missing ${product.slug}`);
   const previous=(await c.query('SELECT id,sku FROM variants WHERE product_id=$1 ORDER BY id',[p.id])).rows;
   const activeIds:number[]=[];
   for(let i=0;i<labels.length;i++){
    const sku=`v29-${product.slug}-${i+1}`;
    const inserted=await c.query(`INSERT INTO variants(product_id,label,sku,stock,is_active)
       VALUES($1,$2,$3,100,true)
       ON CONFLICT(sku) DO UPDATE SET label=EXCLUDED.label,stock=100,is_active=true RETURNING id`,[p.id,labels[i],sku]);
    activeIds.push(inserted.rows[0].id);
   }
   // Historical variants remain for existing orders, but are no longer offered for purchase.
   await c.query('UPDATE variants SET is_active=false WHERE product_id=$1 AND NOT (id=ANY($2::int[]))',[p.id,activeIds]);
   const actual=(await c.query('SELECT count(*)::int AS n FROM variants WHERE product_id=$1 AND is_active',[p.id])).rows[0].n;
   if(actual!==labels.length)throw Error(`Expected ${labels.length} cartridge choices, got ${actual}: ${product.slug}`);
  }
  const slugs=products.map(p=>p.slug);
  await c.query(`UPDATE products SET is_active=false WHERE category_id=(SELECT id FROM categories WHERE slug='kartrydzhi')
      AND UPPER(TRIM(brand))=ANY(ARRAY['OXVA','VAPORESSO','VOOPOO']) AND NOT (slug=ANY($1::text[]))`,[slugs]);
  const n=(await c.query(`SELECT count(*)::int AS n FROM products WHERE is_active AND category_id=(SELECT id FROM categories WHERE slug='kartrydzhi') AND UPPER(TRIM(brand))=ANY(ARRAY['OXVA','VAPORESSO','VOOPOO'])`)).rows[0].n;
  if(n!==4)throw Error(`Expected 4 active cartridge products, got ${n}`);
 });
 console.log('Catalog v2.9: 4 cartridge products, 23 variants, 100 each');
}
