import {db,HttpError,removeProject} from './server';
import {account,isAdmin} from './credits';
export async function billingApi(route:string,action:string,method:string,owner:string,b:any){
 const a=await account(owner);
 const subscriptionsEnabled=process.env.ENABLE_SUBSCRIPTIONS==='true';
 if(route==='billing'){
  if(method==='GET')return {account:a,subscriptionsEnabled,plans:subscriptionsEnabled?(await db().prepare('SELECT * FROM plans WHERE active=1').all()).results:[],subscriptions:(await db().prepare('SELECT * FROM subscriptions WHERE owner=? ORDER BY created DESC').bind(owner).all()).results,ledger:(await db().prepare('SELECT * FROM credit_ledger WHERE owner=? ORDER BY created DESC LIMIT 100').bind(owner).all()).results};
  if(method==='POST'){if(!subscriptionsEnabled)throw new HttpError(403,'Subscriptions are unavailable in this private beta.');const plan=await db().prepare('SELECT id FROM plans WHERE id=? AND active=1').bind(b.plan||'').first();if(!plan)throw new HttpError(400,'Choose an active plan.');await db().prepare("INSERT INTO subscriptions(id,owner,plan,created) VALUES(?,?,?,?) ON CONFLICT DO NOTHING").bind(crypto.randomUUID(),owner,b.plan,Date.now()).run();return {ok:true};}
 }
 if(!isAdmin(owner))throw new HttpError(403,'Administrator access required.');
 if(method==='GET')return {accounts:(await db().prepare('SELECT * FROM accounts LIMIT 500').all()).results,projects:(await db().prepare('SELECT id,owner,name,status,error FROM projects ORDER BY created DESC LIMIT 500').all()).results,subscriptions:(await db().prepare('SELECT * FROM subscriptions ORDER BY created DESC LIMIT 500').all()).results,plans:(await db().prepare('SELECT * FROM plans').all()).results,audit:(await db().prepare('SELECT * FROM admin_audit ORDER BY created DESC LIMIT 100').all()).results,daily:a.daily};
 if(method!=='POST')throw new HttpError(405,'Method not allowed.');
 const audit=db().prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,String(b.id||action),action,JSON.stringify(b).slice(0,2000),Date.now());
 if(action==='daily'){if(!Number.isInteger(b.daily)||b.daily<0||b.daily>100000)throw new HttpError(400,'Invalid daily allowance.');await db().batch([db().prepare('UPDATE credit_settings SET daily=? WHERE id=1').bind(b.daily),audit]);}
 else if(action==='activate'){
  if(!subscriptionsEnabled)throw new HttpError(403,'Subscriptions are disabled.');
  const subscription=await db().prepare('SELECT owner FROM subscriptions WHERE id=?').bind(b.id||'').first<any>();
  if(!subscription)throw new HttpError(404,'Subscription request not found.');
  await account(subscription.owner);
  if(typeof b.reference!=='string'||!b.reference.trim()||b.reference.length>300)throw new HttpError(400,'Add a payment or approval reference.');
  await db().batch([db().prepare("UPDATE subscriptions SET status='active',reference=?,expires=?+(SELECT days*86400000 FROM plans WHERE id=subscriptions.plan) WHERE id=? AND status='requested'").bind(b.reference,Date.now(),b.id),audit]);
 }else if(action==='disable'){
  if(b.id===owner)throw new HttpError(400,'You cannot disable your own admin account.');
  await db().batch([db().prepare('UPDATE accounts SET disabled=? WHERE id=?').bind(b.disabled?1:0,b.id),audit]);
 }else if(action==='grant'){
  if(!Number.isInteger(b.credits)||b.credits<1||b.credits>100000||typeof b.reason!=='string'||!b.reason.trim())throw new HttpError(400,'Enter positive credits and a reason.');
  await db().batch([db().prepare('UPDATE accounts SET paid=CASE WHEN paid_until>? THEN paid ELSE 0 END+?,paid_until=GREATEST(paid_until,?) WHERE id=?').bind(Date.now(),b.credits,Date.now()+30*86400000,b.id),audit]);
 }else if(action==='plan'){
  if(!/^[a-z0-9-]{1,40}$/.test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!Number.isInteger(b.credits)||b.credits<1||b.credits>100000||!Number.isInteger(b.days)||b.days<1||b.days>365||typeof b.price!=='string'||b.price.length>100)throw new HttpError(400,'Invalid plan.');
  await db().batch([db().prepare('INSERT INTO plans VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,credits=excluded.credits,days=excluded.days,price=excluded.price').bind(b.id,b.name,b.credits,b.days,b.price),audit]);
 }else if(action==='delete-project'){
  const p=await db().prepare('SELECT * FROM projects WHERE id=?').bind(b.id).first();if(!p)throw new HttpError(404,'Project not found.');await audit.run();await removeProject(p);
 }else throw new HttpError(404,'Unknown admin action.');
 return {ok:true};
}
