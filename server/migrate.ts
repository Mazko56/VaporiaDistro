import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pool} from './db';
export async function migrate() {
  // schema SQL is copied next to compiled JS during build via app startup fallback
  const paths = [path.join(process.cwd(),'server','schema.sql'), path.join(process.cwd(),'dist-server','schema.sql')];
  const file = paths.find(p=>fs.existsSync(p));
  if(!file) throw new Error('schema.sql not found');
  await pool.query(fs.readFileSync(file,'utf8'));
  console.log('Database schema ready');
}
if (require.main===module) migrate().then(()=>pool.end()).catch(e=>{console.error(e);process.exit(1);});
