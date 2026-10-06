import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase} from '../lib/database.ts';
import * as ugcDomain from '../lib/ugc-domain.mjs';
import * as templateDomain from '../lib/template-settings.mjs';
import * as domain from '../lib/domain.mjs';
import * as creditsDomain from '../lib/credits-domain.mjs';
const require = createRequire(import.meta.url);
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function load(path, modules) {
 const source = await readFile(new URL(path,import.meta.url),'utf8');
 const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={}; new Function('require','exports',code)(name=>modules[name]||require(name),exports); return exports;
}
test('cloud API completes upload, transcription, editor and export; enforces ownership and job leases', async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec(await readFile(new URL('../supabase/migrations/0001_loofy.sql',import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../supabase/migrations/0002_clip_templates.sql',import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../supabase/migrations/0003_ugc_drafts.sql',import.meta.url),'utf8'));
 const driver=c=>({unsafe:async(sql,values)=>{const r=await c.query(sql,values);return Object.assign(r.rows,{count:r.affectedRows??r.rows.length})},begin:fn=>c.transaction(tx=>fn(driver(tx)))});
 const db=createDatabase(driver(pg));
 const objects=new Map();
 const bucket={
  createMultipartUpload:async()=>({uploadId:'upload-test'}),
  resumeMultipartUpload:(key)=>({signPart:async(n)=>({url:'https://storage.example/part',partNumber:n}),complete:async()=>objects.set(key,{size:1000}),abort:async()=>{}}),
  head:async key=>objects.get(key)||null,
  signedGet:async key=>'https://storage.example/'+key,
  list:async()=>({objects:[],truncated:false}),delete:async()=>{}
 };
 class HttpError extends Error {constructor(status,message){super(message);this.status=status}}
 let current=owner,adminIds='';
 const server={db:()=>db,bindings:()=>({DB:db,BUCKET:bucket,PROCESSOR_TOKEN:'test-secret',ADMIN_USER_IDS:adminIds}),HttpError,
 user:async()=>({userId:current,email:'test@example.test',fullName:null}),
 project:async(id,o)=>{const p=await db.prepare("SELECT * FROM projects WHERE id=? AND owner=? AND status<>'deleting'").bind(id,o).first();if(!p)throw new HttpError(404,'Not found');return p},
 event:async(o,name,value=null)=>db.prepare('INSERT INTO events(owner,name,value,created) VALUES(?,?,?,?)').bind(o,name,value,Date.now()).run(),
 media:async(r,key)=>new Response(null,{status:307,headers:{Location:await bucket.signedGet(key)}}),removeProject:async()=>{}};
 const credits=await load('../lib/credits.ts',{'./server':server,'./credits-domain.mjs':creditsDomain});
 const billing=await load('../lib/billing-api.ts',{'./server':server,'./credits':credits});
 const templates=await load('../lib/templates-api.ts',{'./server':server,'./template-settings.mjs':templateDomain});
 const ugcRender=await load('../lib/ugc-render.ts',{'./server':server,'./credits':credits,'./ugc-domain.mjs':ugcDomain});
 const ugc=await load('../lib/ugc-api.ts',{'./server':server,'./credits':credits,'./ugc-render':ugcRender,'./ugc-domain.mjs':ugcDomain});
 const route=await load('../app/api/[...path]/route.ts',{'@/lib/ugc-render':ugcRender,'@/lib/ugc-api':ugc,'@/lib/templates-api':templates,'@/lib/server':server,'@/lib/credits':credits,'@/lib/billing-api':billing,'@/lib/domain.mjs':domain,'@/lib/credits-domain.mjs':creditsDomain});
 async function call(path,method='GET',body,headers={}){
  const r=await route[method](new Request('https://app.example/api/'+path,{method,headers:{Origin:'https://app.example',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:r.status,data:r.status===307?r.headers.get('location'):await r.json()};
 }

 const brief={scenes:[{title:'Hook',visual:'Close-up',narration:'Look at this.',seconds:3}],title:'Product launch',product:'Coffee',script:'Discover the details.',mode:'product',language:'id',style:'natural',ratio:'9:16',duration:10,rights:false,image:''};
 const draft=await call('ugc','POST',brief);assert.equal(draft.status,200,JSON.stringify(draft));
 assert.equal((await call('ugc')).data.generationEnabled,false);
 assert.equal((await call('ugc/'+draft.data.id,'PUT',{...brief,title:'Updated campaign'})).status,200);
 assert.equal((await call('ugc')).data.drafts[0].data.title,'Updated campaign');
 assert.deepEqual((await call('ugc')).data.drafts[0].data.scenes,brief.scenes);
 assert.equal((await call('ugc','POST',{...brief,duration:999})).status,400);
 const discard=await call('ugc','POST',brief);assert.equal((await call('ugc/'+discard.data.id,'DELETE')).status,200);
 for(let n=1;n<20;n++)assert.equal((await call('ugc','POST',brief)).status,200);
 assert.equal((await call('ugc','POST',brief)).status,409);
 const pid=crypto.randomUUID();
 let r=await call('projects','POST',{name:'test.mp4',size:1000,duration:30,language:'en',youtube:'',rights:true},{'Idempotency-Key':pid});
 assert.equal(r.status,201,JSON.stringify(r));
 assert.equal((await call('projects','POST',{name:'test.mp4',size:1000,duration:30,language:'en',rights:true},{'Idempotency-Key':pid})).data.id,pid);
 assert.equal((await call(`projects/${pid}/part/1`,'POST',{size:1000})).status,200);
 assert.equal((await call(`projects/${pid}/complete`,'POST',{parts:[{partNumber:1,etag:'part'}]})).status,200);
 const auth={Authorization:'Bearer test-secret','X-Render-Version':'3'};
 const job=(await call('worker/claim','POST',undefined,auth)).data.job;
 assert.equal(job.project,pid);
 const jobHeaders={...auth,'X-Job-Token':job.token};
 assert.equal((await call(`worker/jobs/${pid}/source`,'GET',undefined,jobHeaders)).data.url,`https://storage.example/${pid}/source`);
 assert.equal((await call(`worker/jobs/${pid}/heartbeat`,'POST',{progress:10,stage:'transcribing'},jobHeaders)).status,200);
 assert.equal((await call(`worker/jobs/${pid}/finish`,'POST',{duration:30,language:'en',words:Array.from({length:30},(_,i)=>({start:i,end:i+0.8,text:'hello'}))},jobHeaders)).status,200);
 const project=(await call(`projects/${pid}`)).data;
 assert.ok(project.clips.length>0);
 assert.ok(project.clips.every(c=>c.data.ratio==='9:16' && c.data.fit==='cover'),'automatic clips fill the vertical frame');
 assert.ok(project.clips.every(c=>c.data.headlineEnabled===false&&c.data.headline&&c.data.textEffect==='highlight'&&Array.isArray(c.data.segments)),'suggestions include the vertical clip foundations');
 const cid=project.clips[0].id;
 const settings=project.clips[0].data;
 const saved=await call('templates','POST',{name:'Podcast',settings});assert.equal(saved.status,200,JSON.stringify(saved));
 assert.equal(saved.data.settings.title,undefined);
 assert.equal((await call('templates')).data.templates.length,1);
 assert.equal((await call('templates','POST',{name:'podcast',settings})).status,409);
 assert.equal((await call('templates','POST',{name:'Broken',settings:{fontSize:1000}})).status,400);
 assert.equal((await call('templates/'+saved.data.id,'PUT',{name:'Podcast updated',settings:{...settings,fontSize:60}})).status,200);
 assert.equal((await call('templates')).data.templates[0].settings.fontSize,60);
 const extraTemplate=await call('templates','POST',{name:'Delete me',settings});
 assert.equal((await call('templates/'+extraTemplate.data.id,'DELETE')).status,200);
 assert.equal((await call('templates/'+extraTemplate.data.id,'DELETE')).status,404);
 for(let n=1;n<20;n++)assert.equal((await call('templates','POST',{name:'Look '+n,settings})).status,200);
 assert.equal((await call('templates','POST',{name:'Too many',settings})).status,409);
 assert.equal((await pg.query("select relrowsecurity from pg_class where relname='clip_templates'")).rows[0].relrowsecurity,true);

 assert.equal((await call('projects')).data.projects[0].clipCount,project.clips.length);
 const exp=await call(`clips/${cid}/export`,'POST');assert.equal(exp.status,201,JSON.stringify(exp));
 assert.equal((await call(`clips/${cid}/export`,'POST')).data.id,exp.data.id);
 assert.equal((await call('worker/claim','POST',undefined,{Authorization:'Bearer test-secret'})).data.job,null,'legacy worker cannot consume a new render');
 assert.equal((await call('worker/claim','POST',undefined,{Authorization:'Bearer test-secret','X-Render-Version':'2'})).data.job,null,'v2 cannot render headline jobs');
 const exportJob=(await call('worker/claim','POST',undefined,auth)).data.job;
 const exportAuth={...auth,'X-Job-Token':exportJob.token};
 for(const [action,body] of [['output-start',undefined],['output-part/1',{size:1000}],['output-complete',{parts:[{partNumber:1,etag:'part'}]}],['finish',{}]]){
  const r=await call(`worker/jobs/${exportJob.id}/${action}`,'POST',body,exportAuth);assert.equal(r.status,200,JSON.stringify(r));
 }
 assert.equal((await call(`exports/${exportJob.id}`)).status,307);

 // An interrupted export must retain its storage reservation until removal is confirmed.
 const failed=await call(`clips/${cid}/export`,'POST');
 await db.prepare("UPDATE jobs SET status='running',lease=1,attempts=3 WHERE id=?").bind(failed.data.id).run();
 await call('worker/claim','POST',undefined,auth);
 assert.equal((await db.prepare('SELECT size FROM jobs WHERE id=?').bind(failed.data.id).first()).size,1073741824);
 // Deleting rows stay owner-visible, and DELETE can be retried after R2 failure.
 await db.prepare("UPDATE projects SET status='deleting' WHERE id=?").bind(pid).run();
 assert.equal((await call('projects')).data.projects.length,1);
 assert.equal((await call(`projects/${pid}`,'DELETE')).status,200);
 await db.prepare("UPDATE projects SET status='ready' WHERE id=?").bind(pid).run();
 const yid=crypto.randomUUID();
 assert.equal((await call('projects/youtube','POST',{url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',language:'id',rights:true},{'Idempotency-Key':yid})).status,201);
 const yjob=(await call('worker/claim','POST',undefined,auth)).data.job;
 const yh={...auth,'X-Job-Token':yjob.token};
 assert.equal((await call(`worker/jobs/${yid}/import-prepare`,'POST',{duration:120,name:'YouTube fixture'},yh)).status,200);
 assert.equal((await call(`worker/jobs/${yid}/import-part/1`,'POST',{size:1000},yh)).status,200);
 assert.equal((await call(`worker/jobs/${yid}/import-complete`,'POST',{parts:[{partNumber:1,etag:'part'}]},yh)).status,200);
 assert.equal((await call('billing','POST',{plan:'creator'})).status,403);
 // Personal UGC: real route validation, idempotency, capability, storage upload, finish and ownership.
 assert.equal((await call('ugc/'+draft.data.id+'/render','POST',{})).status,403);
 adminIds=owner;
 const product={...brief,rights:true,image:'data:image/jpeg;base64,/9j/AA=='};
 assert.equal((await call('ugc/'+draft.data.id,'PUT',product)).status,200);
 const productJob=await call('ugc/'+draft.data.id+'/render','POST',{});assert.equal(productJob.status,200,JSON.stringify(productJob));
 assert.equal((await call('ugc/'+draft.data.id+'/render','POST',{})).data.projectId,productJob.data.projectId);
 assert.equal((await call('ugc/'+draft.data.id+'/render','POST',{voice:'https://bad.test/a.mp3'})).status,400);
 const oldWorker=await call('worker/claim','POST',undefined,{...auth,'X-Render-Version':'3'});assert.equal(oldWorker.data.job,null);
 const productClaim=(await call('worker/claim','POST',undefined,{...auth,'X-Render-Version':'5'})).data.job;assert.equal(productClaim.id,productJob.data.projectId);
 const ph={...auth,'X-Job-Token':productClaim.token};
 assert.equal((await call('worker/jobs/'+productClaim.id+'/finish','POST',{},ph)).status,409);
 assert.equal((await call('worker/jobs/'+productClaim.id+'/import-prepare','POST',{duration:3,name:'Product fixture'},ph)).status,200);
 assert.equal((await call('worker/jobs/'+productClaim.id+'/import-complete','POST',{parts:[{partNumber:1,etag:'part'}]},ph)).status,200);
 assert.equal((await call('worker/jobs/'+productClaim.id+'/finish','POST',{},ph)).status,200);
 assert.equal((await call('ugc/renders')).data.renders[0].status,'complete');
 assert.equal((await call('projects/'+productClaim.id)).data.status,'ready');
 assert.equal((await call('ugc/'+draft.data.id+'/render','POST',{})).data.status,'complete');
 adminIds='';
 current='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 assert.equal((await call('ugc/renders')).data.renders.length,0);
 assert.equal((await call('ugc')).data.drafts.length,0);
 assert.equal((await call('ugc/'+draft.data.id,'PUT',brief)).status,404);
 assert.equal((await call('ugc/'+draft.data.id,'DELETE')).status,404);
 assert.equal((await call('templates')).data.templates.length,0);
 assert.equal((await call('templates/'+saved.data.id,'DELETE')).status,404);
 assert.equal((await call('templates/'+saved.data.id,'PUT',{name:'Stolen',settings})).status,404);

 assert.equal((await call(`projects/${pid}`)).status,404);
 assert.equal((await call(`exports/${exportJob.id}`)).status,404);
 assert.equal((await call('admin')).status,403);
 assert.equal((await call(`worker/jobs/${pid}/source`,'GET',undefined,{...auth,'X-Job-Token':'stale'})).status,409);
});
