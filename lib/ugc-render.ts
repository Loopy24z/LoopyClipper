import {createHash} from 'node:crypto';
import {db,HttpError} from './server';
import {isAdmin} from './credits';
import {validateUgcDraft} from './ugc-domain.mjs';
export async function ugcRender(owner:string,draftId:string,body:any){
 if(!isAdmin(owner))throw new HttpError(403,'Local UGC rendering is currently available to the workspace administrator.');
 const audio:any={};let bytes=0;
 for(const key of ['voice','music']){const value=body[key]||'';if(typeof value!=='string'||value.length>1400000||value&&!/^data:audio\/(?:mpeg|mp3);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new HttpError(400,'Use MP3 audio, at most 1 MB combined.');bytes+=value.length;audio[key]=value;}
 if(bytes>1400000)throw new HttpError(400,'Voiceover and music must total at most 1 MB.');
 return db().transaction(async()=>{
 await db().prepare('SELECT id FROM accounts WHERE id=? FOR UPDATE').bind(owner).first();
 const row=await db().prepare('SELECT data FROM ugc_drafts WHERE id=? AND owner=? FOR UPDATE').bind(draftId,owner).first<any>();if(!row)throw new HttpError(404,'Draft not found.');
 const data:any=validateUgcDraft(JSON.parse(row.data));
 if(data.mode!=='product'||!data.image||!data.rights)throw new HttpError(400,'Choose Product story, add an image and confirm permission before rendering.');
 if(!data.scenes?.length&&data.script.length>350)throw new HttpError(400,'Split this script into storyboard scenes before rendering.');
 if(!data.scenes?.length) data.scenes=[{title:'Product story',visual:'',narration:data.script.slice(0,350),seconds:data.duration}];
 const duration=data.scenes.reduce((sum:number,s:any)=>sum+s.seconds,0);
 const snapshot={...data,...audio};const key='ugc-'+createHash('sha256').update(JSON.stringify([owner,draftId,snapshot])).digest('hex');
 const prior=await db().prepare('SELECT id,status FROM jobs WHERE id=?').bind(key).first<any>();
 if(prior&&prior.status!=='failed')return {projectId:key,status:prior.status};
 const active=await db().prepare("SELECT j.id FROM jobs j JOIN projects p ON p.id=j.project WHERE p.owner=? AND j.payload::jsonb->'ugc' IS NOT NULL AND j.status IN ('queued','running')").bind(owner).first();
 if(active)throw new HttpError(409,'A product video is already queued or rendering. Wait for it to finish.');
 if(prior){await db().prepare("UPDATE projects SET size=134217728,status='queued',error=NULL WHERE id=?").bind(key).run();await db().prepare("UPDATE jobs SET status='queued',attempts=0,lease=0,error=NULL,progress=0,token=NULL WHERE id=?").bind(key).run();}
 else{
 const usage=await db().prepare("SELECT (SELECT COALESCE(SUM(size),0) FROM projects WHERE owner=?)+(SELECT COALESCE(SUM(j.size),0) FROM jobs j JOIN projects p ON p.id=j.project WHERE p.owner=? AND j.kind='export') AS bytes").bind(owner,owner).first<any>();
 if(Number(usage.bytes)+134217728>10737418240)throw new HttpError(409,'Free some project storage before rendering.');
 await db().prepare("INSERT INTO projects(id,owner,name,size,duration,language,status,created) VALUES(?,?,?,134217728,?,?,'queued',?)").bind(key,owner,data.title,duration,data.language,Date.now()).run();
 await db().prepare("INSERT INTO jobs(id,project,kind,payload,created) VALUES(?,?,'transcribe',?,?)").bind(key,key,JSON.stringify({renderVersion:5,ugc:snapshot,ugcDraftId:draftId}),Date.now()).run();
 }
 return {projectId:key,status:'queued'};
 });
}
export async function ugcRenders(owner:string){return (await db().prepare("SELECT j.id AS \"projectId\",j.status,j.progress,j.error,p.name,j.created,j.payload::jsonb->>'ugcDraftId' AS \"draftId\" FROM jobs j JOIN projects p ON p.id=j.project WHERE p.owner=? AND j.payload::jsonb->'ugc' IS NOT NULL ORDER BY j.created DESC LIMIT 20").bind(owner).all()).results;}
