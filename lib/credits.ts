import {bindings,db,HttpError} from './server';
import {creditDay,creditCost} from './credits-domain.mjs';
export function isAdmin(id:string){return ((bindings() as any).ADMIN_USER_IDS||'').split(',').map((s:string)=>s.trim()).filter((s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)).includes(id);}
export async function account(id:string,email?:string){
 const day=creditDay();
 if(email)await db().prepare('INSERT INTO accounts(id,email,day) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(id,email,day).run();
 await db().batch([db().prepare('UPDATE accounts SET day=?,daily_used=0 WHERE id=? AND day<>?').bind(day,id,day),db().prepare('UPDATE accounts SET paid=0,paid_until=0 WHERE id=? AND paid_until<=?').bind(id,Date.now())]);
 const a=await db().prepare('SELECT a.*,s.daily FROM accounts a CROSS JOIN credit_settings s WHERE a.id=?').bind(id).first<any>();
 if(!a)throw new HttpError(404,'Account not found.');
 if(a.disabled)throw new HttpError(403,'This account is disabled. Contact the administrator.');
 return {...a,free:Math.max(0,a.daily-a.daily_used),admin:isAdmin(id),unlimited:isAdmin(id),nextReset:Date.parse(day+'T00:00:00+07:00')+86400000};
}
export async function chargeStatement(owner:string,project:string,duration:number){const a=await account(owner);const cost=creditCost(duration);if(a.unlimited)return db().prepare('SELECT 1');const free=Math.min(a.free,cost);return db().prepare('INSERT INTO credit_ledger(project,owner,day,free,paid,created) VALUES(?,?,?,?,?,?)').bind(project,owner,a.day,free,cost-free,Date.now());}
export const refund=(project:string)=>db().prepare('UPDATE credit_ledger SET refunded=1 WHERE project=? AND refunded=0').bind(project);
