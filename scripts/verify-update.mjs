import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd();const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('src/App.tsx'),db=read('server/schema.sql'),api=read('server/index.ts'),seed=read('server/seed.ts');
for(const item of ['pod-systemy','ridyny','kartrydzhi'])assert(ui.includes(item),`Missing main category: ${item}`);
for(const item of ['CHASER','HYPE','MOOD','DUCK','PUNCH','LUCKY','IN BOTTLE','ELFLIQ','ELYZIUM LAB','OCTOLAB','VAPORESSO','OXVA','VOOPOO'])assert(seed.includes(`'${item}'`),`Missing manufacturer: ${item}`);
for(const item of ['main','bonus','delivery']){const bin=fs.readFileSync(path.join(root,`public/banners/${item}.webp`));assert.equal(bin.toString('ascii',0,4),'RIFF');assert.equal(bin.toString('ascii',8,12),'WEBP');assert(bin.byteLength>50000);}
assert(ui.includes('function HeroCarousel'));assert(ui.includes('onTouchEnd='));assert(ui.includes('function PhotoField'));assert(ui.includes('function GalleryPhotosField'));assert(ui.includes('function BrandPage'));assert(ui.includes('safe-area-inset-bottom')===false);assert(read('src/style.css').includes('safe-area-inset-bottom'));
assert(api.includes("app.post('/api/admin/media'"));assert(api.includes("app.get('/api/media/:id'"));assert(api.includes("app.get('/api/brands'"));assert(api.includes("app.get('/api/admin/brands'"));assert(db.includes('media_assets'));assert(db.includes('CREATE TABLE IF NOT EXISTS brands'));
assert(!ui.includes('ЛАСКАВО ПРОСИМО'));
assert(ui.includes('category-outline-chip'));
assert(ui.includes('brand-filter-chip'));
assert(ui.includes('VariantEditor'));
assert(!ui.includes('Наші <em>виробники</em>'));
assert(read('src/style.css').includes('aspect-ratio:2.0 / 1'));
assert(api.includes("shouldAwardOrder(old.status as OrderStatus,status,Number(old.bonus_awarded))"));
assert(db.includes("'received','completed','cancelled'"));
assert(read('server/orderLifecycle.ts').includes('canTransitionOrder'));
console.log('VAPORIA update 1.2 asset, category and bonus checks: PASS');
