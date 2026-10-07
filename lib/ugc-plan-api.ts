import {db,HttpError} from './server';
import {isAdmin} from './credits';
import {validateCreativePlan} from './ugc-plan-domain.mjs';
export async function creativePlan(owner:string,draft:string,method:string,body:any){
 if(!await db().prepare('SELECT id FROM ugc_drafts WHERE id=? AND owner=?').bind(draft,owner).first())throw new HttpError(404,'Draft not found.');
 if(method==='GET'){
  const row=await db().prepare('SELECT status,result,error,brief,updated FROM ugc_plans WHERE draft=? AND owner=?').bind(draft,owner).first<any>();
  return {plan:row?{...row,result:row.result?JSON.parse(row.result):null,brief:JSON.parse(row.brief)}:null};
 }
 if(method!=='POST')throw new HttpError(405,'Method not allowed.');
 if(!isAdmin(owner))throw new HttpError(403,'Local AI planning is currently available to the workspace administrator.');
 const brief:any={};for(const [key,max] of [['facts',2000],['audience',300],['cta',200]] as const){if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>max)throw new HttpError(400,'Fill in product facts, audience and call to action.');brief[key]=body[key].trim();}
 return db().transaction(async()=>{
  await db().prepare('SELECT id FROM accounts WHERE id=? FOR UPDATE').bind(owner).first();
  const active=await db().prepare("SELECT draft FROM ugc_plans WHERE owner=? AND (status='queued' OR (status='running' AND lease>?))").bind(owner,Date.now()).first<any>();
  if(active){if(active.draft===draft)return {queued:true};throw new HttpError(409,'Another creative plan is in progress. Wait for it to finish.');}
  const source=await db().prepare('SELECT data FROM ugc_drafts WHERE id=? AND owner=?').bind(draft,owner).first<any>();
  if(!source)throw new HttpError(404,'Draft was deleted.');
  const data=JSON.parse(source.data);brief.product=data.product||data.title;brief.language=data.language;
  await db().prepare("INSERT INTO ugc_plans(draft,owner,status,brief,updated) VALUES(?,?,'queued',?,?) ON CONFLICT(draft) DO UPDATE SET status='queued',brief=excluded.brief,result=NULL,error=NULL,token=NULL,lease=0,attempts=0,updated=excluded.updated").bind(draft,owner,JSON.stringify(brief),Date.now()).run();
  return {queued:true};
 });
}
export async function planWorker(action:string,body:any){
 if(action==='claim'){
  await db().prepare("UPDATE ugc_plans SET status='failed',error='AI planning was interrupted. Restart the Windows worker and retry.' WHERE status='running' AND lease<? AND attempts>=3").bind(Date.now()).run();
  const row=await db().prepare("UPDATE ugc_plans SET status='running',token=?,lease=?,attempts=attempts+1,updated=? WHERE draft=(SELECT draft FROM ugc_plans WHERE status='queued' OR (status='running' AND lease<? AND attempts<3) ORDER BY updated LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING draft,brief,token").bind(crypto.randomUUID(),Date.now()+600000,Date.now(),Date.now()).first<any>();
  return {job:row?{...row,brief:JSON.parse(row.brief)}:null};
 }
 if(action!=='finish'&&action!=='fail')throw new HttpError(404,'Unknown planner action.');
 let result=null,error=null;
 if(action==='finish'){const claim=await db().prepare("SELECT brief FROM ugc_plans WHERE draft=? AND token=? AND status='running' AND lease>?").bind(body.draft,body.token,Date.now()).first<any>();if(!claim)throw new HttpError(409,'Plan claim expired.');try{result=JSON.stringify(validateCreativePlan(body.result,JSON.parse(claim.brief).facts))}catch(e){throw new HttpError(400,(e as Error).message);}}
 else error=body.error==='model_missing'?'Install the local AI model, then retry.':body.error==='offline'?'Start Ollama and the Windows worker, then retry.':'The local AI could not produce a valid plan. Shorten the brief and retry.';
 const updated=await db().prepare('UPDATE ugc_plans SET status=?,result=?,error=?,token=NULL,lease=0,updated=? WHERE draft=? AND token=? AND status=? AND lease>?').bind(action==='finish'?'complete':'failed',result,error,Date.now(),body.draft,body.token,'running',Date.now()).run();
 if(!updated.meta.changes)throw new HttpError(409,'This plan claim has expired or was deleted.');
 return {ok:true};
}
