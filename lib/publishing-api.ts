import {db,HttpError} from './server';
import {isAdmin} from './credits';
import {storage} from './storage';
import {publishPlatforms,validatePublication,publicationLink} from './publishing-domain.mjs';
const now=()=>Date.now();
async function expire(){
 await db().prepare("UPDATE publication_jobs SET status=CASE WHEN started=1 THEN 'review' ELSE 'failed' END,error=CASE WHEN started=1 THEN 'Delivery was interrupted. Check the destination account before posting again; the platform may already have received the video.' ELSE 'The publishing worker stopped before upload. Restart it and retry.' END,updated=? WHERE status='running' AND lease<?").bind(now(),now()).run();
}
export async function publishingApi(owner:string,exportId:string,method:string,b:any){
 const exp=await db().prepare("SELECT j.*,p.owner FROM jobs j JOIN projects p ON p.id=j.project WHERE j.id=? AND j.kind='export' AND j.status='complete' AND p.owner=? AND p.status<>'deleting'").bind(exportId,owner).first<any>();
 if(!exp)throw new HttpError(404,'Completed export not found.');
 await expire();
 if(method==='GET'){
  const accounts=await db().prepare('SELECT platform,remote_id,label,seen FROM publishing_accounts WHERE owner=?').bind(owner).all<any>();
  const jobs=await db().prepare('SELECT id,platform,account_label,status,error,remote_id,created FROM publication_jobs WHERE export_id=? AND owner=? ORDER BY created').bind(exportId,owner).all<any>();
  return {admin:isAdmin(owner),clip:JSON.parse(exp.payload).clip,accounts:accounts.results.map(a=>({...a,online:a.seen>now()-900000})),jobs:jobs.results.map(j=>({...j,url:publicationLink(j.platform,j.remote_id)}))};
 }
 if(!isAdmin(owner))throw new HttpError(403,'Direct publishing is currently limited to the configured workspace owner.');
 if(method==='DELETE'){
  await db().prepare("UPDATE publication_jobs SET status='cancelled',updated=? WHERE export_id=? AND owner=? AND platform=? AND status='queued'").bind(now(),exportId,owner,b.platform).run();return {ok:true};
 }
 if(method!=='POST')throw new HttpError(405,'Method not allowed.');
 let payload;try{payload=validatePublication(b,JSON.parse(exp.payload).clip)}catch(e){throw new HttpError(400,(e as Error).message)}
 const account=await db().prepare('SELECT * FROM publishing_accounts WHERE owner=? AND platform=? AND seen>?').bind(owner,b.platform,now()-900000).first<any>();
 if(!account)throw new HttpError(409,'Connect this platform in the local worker and keep it online before sending.');
 // Same export/platform is one operation: concurrent clicks or network retries never create a second post.
 const jobId=crypto.randomUUID();
 await db().prepare("INSERT INTO publication_jobs(id,owner,export_id,platform,account_id,account_label,payload,created,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(export_id,platform) DO UPDATE SET status='queued',payload=excluded.payload,account_id=excluded.account_id,account_label=excluded.account_label,token=NULL,lease=0,error=NULL,updated=excluded.updated WHERE publication_jobs.status IN ('failed','cancelled') AND publication_jobs.started=0").bind(jobId,owner,exportId,b.platform,account.remote_id,account.label,JSON.stringify(payload),now(),now()).run();
 const current=await db().prepare('SELECT id,status FROM publication_jobs WHERE export_id=? AND platform=? AND owner=?').bind(exportId,b.platform,owner).first<any>();
 return {job:current,queued:current?.status==='queued'};
}
export async function publishWorker(action:string,b:any){
 if(action==='accounts'){
  if(!isAdmin(b.owner))throw new HttpError(403,'Publishing owner must be an administrator.');
  if(!Array.isArray(b.accounts)||b.accounts.length>3)throw new HttpError(400,'Invalid publishing connections.');
  await db().transaction(async()=>{
   await db().prepare('DELETE FROM publishing_accounts WHERE owner=?').bind(b.owner).run();
   for(const a of b.accounts){
    if(!publishPlatforms.includes(a.platform)||typeof a.id!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(a.id)||typeof a.label!=='string'||a.label.length>200)throw new HttpError(400,'Invalid publishing account.');
    await db().prepare('INSERT INTO publishing_accounts(owner,platform,remote_id,label,seen) VALUES(?,?,?,?,?)').bind(b.owner,a.platform,a.id,a.label,now()).run();
   }
  });return {ok:true};
 }
 if(action==='claim'){
  if(!isAdmin(b.owner))return {job:null};
  await expire();
  const job=await db().prepare("UPDATE publication_jobs SET status='running',token=?,lease=?,updated=? WHERE id=(SELECT j.id FROM publication_jobs j JOIN publishing_accounts a ON a.owner=j.owner AND a.platform=j.platform AND a.remote_id=j.account_id WHERE j.status='queued' AND j.owner=? AND a.seen>? ORDER BY j.created LIMIT 1 FOR UPDATE OF j SKIP LOCKED) RETURNING *").bind(crypto.randomUUID(),now()+180000,now(),b.owner,now()-900000).first<any>();
  if(!job)return {job:null};
  const exp=await db().prepare("SELECT j.project FROM jobs j JOIN projects p ON p.id=j.project WHERE j.id=? AND j.status='complete' AND p.status<>'deleting'").bind(job.export_id).first<any>();
  if(!exp){await db().prepare("UPDATE publication_jobs SET status='failed',error='Export was deleted.',updated=? WHERE id=?").bind(now(),job.id).run();return {job:null};}
  return {job:{...job,payload:JSON.parse(job.payload),url:await storage.signedGet(`${exp.project}/exports/${job.export_id}.mp4`)}};
 }
 return db().transaction(async()=>{
  const job=await db().prepare("SELECT * FROM publication_jobs WHERE id=? AND token=? AND status='running' AND lease>? FOR UPDATE").bind(b.id,b.token,now()).first<any>();
  if(!job)throw new HttpError(409,'Publishing claim expired.');
  if(action==='heartbeat'){await db().prepare('UPDATE publication_jobs SET lease=?,updated=? WHERE id=?').bind(now()+180000,now(),job.id).run();return {ok:true};}
  if(action==='started'){await db().prepare('UPDATE publication_jobs SET started=1,updated=? WHERE id=?').bind(now(),job.id).run();return {ok:true};}
  if(action==='checkpoint'){
   if(typeof b.remoteId!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(b.remoteId))throw new HttpError(400,'Invalid remote identifier.');
   await db().prepare('UPDATE publication_jobs SET remote_id=?,updated=? WHERE id=?').bind(b.remoteId,now(),job.id).run();return {ok:true};
  }
  if(action==='finish'||action==='fail'){
   if(action==='finish'&&!job.remote_id)throw new HttpError(409,'Platform confirmation is missing.');
   const status=action==='finish'?'complete':job.started?'review':'failed';
   const error=action==='finish'?null:job.started?'Delivery could not be confirmed. Check your destination account before posting again.':'Connection or export could not be verified. Check the worker configuration and retry.';
   await db().prepare('UPDATE publication_jobs SET status=?,error=?,lease=0,updated=? WHERE id=?').bind(status,error,now(),job.id).run();return {ok:true};
  }
  throw new HttpError(404,'Unknown publishing action.');
 });
}
