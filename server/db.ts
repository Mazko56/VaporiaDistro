import {Pool, type PoolClient, type QueryResultRow} from 'pg';
import {config} from './config';
export const pool = new Pool({connectionString:config.databaseUrl, max:10, connectionTimeoutMillis:10000});
export async function query<T extends QueryResultRow=any>(sql:string, params:unknown[]=[]):Promise<T[]> {
  return (await pool.query<T>(sql,params)).rows;
}
export async function tx<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T> {
  const c=await pool.connect();
  try {await c.query('BEGIN'); const result=await fn(c); await c.query('COMMIT');return result;}
  catch(e) {await c.query('ROLLBACK');throw e;} finally {c.release();}
}
export function money(kop:number) {return (kop/100).toFixed(2);}
