/** Ukrainian phone normalization, shared by checkout UI and API. */
export function normalizeUaPhone(raw:string):string|null {
  if(!/^[+\d\s()-]+$/.test(raw))return null;
  let value=raw.replace(/[\s()-]/g,'');
  if(/^0\d{9}$/.test(value))value='+38'+value;
  else if(/^380\d{9}$/.test(value))value='+'+value;
  return /^\+380\d{9}$/.test(value)?value:null;
}
