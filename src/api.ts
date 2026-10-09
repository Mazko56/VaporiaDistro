export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
  const resp=await fetch('/api'+path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Vaporia-App':'1',...options.headers}});
  let data:any;
  try{data=await resp.json();}catch{throw new Error('Помилка зв’язку із сервером');}
  if(!resp.ok)throw new Error(data?.error || `HTTP ${resp.status}`);
  return data as T;
}
export const json=(method:'POST'|'PATCH'|'DELETE',body?:unknown):RequestInit=>({method,body:body===undefined?undefined:JSON.stringify(body)});
