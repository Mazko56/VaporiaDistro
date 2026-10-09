const url=process.argv[2];
if(!url){console.error('Usage: node scripts/check-live.mjs https://your-service.up.railway.app');process.exit(2);}
for(const path of ['/api/health','/api/config','/']){
 const r=await fetch(url.replace(/\/$/,'')+path);
 console.log(r.status,path,r.headers.get('content-type')||'');
 if(!r.ok)process.exitCode=1;
}
