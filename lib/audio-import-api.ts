import {db,HttpError} from './server';
import {storage} from './storage';
import {audioLink} from './audio-link.mjs';
const key=(id:string)=>`audio-imports/${id}.mp3`;
export async function audioImports(owner:string,method:string,id:string|undefined,body:any){
 const now=Date.now();
 if(method==='GET'){
  await db().prepare("UPDATE audio_imports SET status='failed',error='Import was interrupted. Retry after the processor is online.' WHERE owner=? AND status='running' AND lease<?").bind(owner,now).run();
  const rows=await db().prepare("SELECT id,name,status,error,created FROM audio_imports WHERE owner=? AND expires>? AND status<>'cancelled' ORDER BY created DESC LIMIT 10").bind(owner,now).all<any>();
  const service=await db().prepare("SELECT seen FROM service_state WHERE id='processor'").first<any>();
  return {imports:rows.results,online:!!service&&Number(service.seen)>now-120000};
 }
 if(method==='DELETE'&&id){
  const row=await db().prepare("UPDATE audio_imports SET status='cancelled',token=NULL WHERE id=? AND owner=? RETURNING id").bind(id,owner).first<any>();
  if(!row)throw new HttpError(404,'Import not found.');await storage.delete([key(id)]);return {ok:true};
 }
 if(method==='POST'&&body.action==='load'&&id){
  const row=await db().prepare("SELECT name FROM audio_imports WHERE id=? AND owner=? AND status='complete' AND expires>?").bind(id,owner,now).first<any>();
  if(!row)throw new HttpError(404,'Import expired or is not ready. Import the link again.');return {url:await storage.signedGet(key(id)),name:row.name+'.mp3'};
 }
 if(method!=='POST'||id)throw new HttpError(405,'Unsupported action.');
 if(body.rights!==true)throw new HttpError(400,'Confirm permission to use this audio.');
 let source;try{source=audioLink(body.url);if(source.kind!=='social')throw Error('Use direct-file import in your browser.');}catch(e){throw new HttpError(400,(e as Error).message);}
 return db().transaction(async()=>{
  await db().prepare('SELECT id FROM accounts WHERE id=? FOR UPDATE').bind(owner).first();
  const existing=await db().prepare("SELECT id,status FROM audio_imports WHERE owner=? AND url=? AND status IN ('queued','running','complete') AND expires>? ORDER BY created DESC LIMIT 1").bind(owner,source.url,now).first();if(existing)return existing;
  const usage=await db().prepare('SELECT COUNT(*) AS n FROM audio_imports WHERE owner=? AND created>?').bind(owner,now-86400000).first<any>();
  if(Number(usage.n)>=10)throw new HttpError(429,'Daily link-import limit reached (10). You can still upload local audio.');
  const active=await db().prepare("SELECT id FROM audio_imports WHERE owner=? AND status IN ('queued','running')").bind(owner).first();if(active)throw new HttpError(409,'Wait for the current link import to finish or cancel it.');
  await db().prepare('SELECT id FROM storage_quota WHERE id=1 FOR UPDATE').first();
  const global=await db().prepare("SELECT COUNT(*) AS n FROM audio_imports WHERE expires>? AND status<>'cancelled'").bind(now).first<any>();if(Number(global.n)>=100)throw new HttpError(429,'Link-import storage is busy. Try later or upload a file.');
  const job=crypto.randomUUID();await db().prepare("INSERT INTO audio_imports(id,owner,url,status,created,expires) VALUES(?,?,?,'queued',?,?)").bind(job,owner,source.url,now,now+86400000).run();return {id:job,status:'queued'};
 });
}
export async function audioImportWorker(action:string,body:any){
 const now=Date.now();
 if(action==='claim'){
  await db().prepare("INSERT INTO service_state(id,seen) VALUES('processor',?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen").bind(now).run();
  const expired=await db().prepare('SELECT id FROM audio_imports WHERE expires<? LIMIT 20').bind(now).all<any>();
  for(const row of expired.results){await storage.delete([key(row.id)]);await db().prepare('DELETE FROM audio_imports WHERE id=?').bind(row.id).run();}
  await db().prepare("UPDATE audio_imports SET status='failed',error='Import timed out. Retry after checking the processor.' WHERE status='running' AND lease<?").bind(now).run();
  const job=await db().prepare("UPDATE audio_imports SET status='running',token=?,lease=? WHERE id=(SELECT id FROM audio_imports WHERE status='queued' AND expires>? ORDER BY created LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,url,token").bind(crypto.randomUUID(),now+600000,now).first<any>();return {job};
 }
 const row=await db().prepare("SELECT id FROM audio_imports WHERE id=? AND token=? AND status='running' AND lease>?").bind(body.id,body.token,now).first<any>();if(!row)throw new HttpError(409,'Audio import was cancelled or expired.');
 if(action==='heartbeat'){await db().prepare("UPDATE service_state SET seen=? WHERE id='processor'").bind(now).run();return {ok:true};}
 if(action==='upload'){
  if(!Number.isInteger(body.size)||body.size<1||body.size>25*1024**2)throw new HttpError(400,'Imported audio exceeds 25 MB.');
  return {url:await storage.signedPut(key(row.id),body.size,'audio/mpeg')};
 }
 if(action==='finish'){
  const object=await storage.head(key(row.id));if(!object||object.size<1||object.size>25*1024**2)throw new HttpError(400,'Imported audio is missing or too large.');
  await db().prepare("UPDATE audio_imports SET status='complete',name=?,size=?,token=NULL WHERE id=? AND token=? AND status='running'").bind(String(body.name||'Imported audio').replace(/[\x00-\x1f]/g,'').slice(0,140),object.size,row.id,body.token).run();return {ok:true};
 }
 if(action==='fail'){
  const errors:Record<string,string>={limit:'Use a single video up to 20 minutes and 100 MB. Private/live videos and playlists are not supported.',timeout:'Download timed out. Try a shorter video or upload the audio file.',unavailable:'This platform refused the download or requires login. Try another public link or upload a file.'};
  await db().prepare("UPDATE audio_imports SET status='failed',error=?,token=NULL WHERE id=? AND token=?").bind(errors[body.error]||'Import failed. Check that the link is public, then retry or upload a file.',row.id,body.token).run();await storage.delete([key(row.id)]);return {ok:true};
 }
 throw new HttpError(404,'Unknown audio action.');
}
