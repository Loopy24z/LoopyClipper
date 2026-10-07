import {creativePlan,planWorker} from '@/lib/ugc-plan-api';
import {account,chargeStatement,refund} from '@/lib/credits';
import {billingApi} from '@/lib/billing-api';
import {templatesApi} from '@/lib/templates-api';
import {ugcRender,ugcRenders} from '@/lib/ugc-render';
import {ugcApi} from '@/lib/ugc-api';
import {youtubeVideo} from '@/lib/credits-domain.mjs';
import { bindings, db, user, project, event, removeProject, media, HttpError } from '@/lib/server';
import { PART_SIZE, validateUpload, validateClip, suggestHighlights } from '@/lib/domain.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const id = () => crypto.randomUUID();
const storageSQL = "(SELECT COALESCE(SUM(size),0) FROM projects WHERE owner=?) + (SELECT COALESCE(SUM(j.size),0) FROM jobs j JOIN projects p ON p.id=j.project WHERE p.owner=? AND j.kind='export' AND j.status IN ('queued','running','complete','failed'))";
async function readBytes(r: Request, max: number) { const reader = r.body?.getReader(); if (!reader)
    throw new HttpError(400, 'Missing body.'); const buffer = new Uint8Array(max); let size = 0; while (true) {
    const { done, value } = await reader.read();
    if (done)
        break;
    if (size + value.byteLength > max) {
        await reader.cancel();
        throw new HttpError(413, 'Request exceeds the size limit.');
    }
    buffer.set(value, size);
    size += value.byteLength;
} return buffer.slice(0, size); }
async function body(r: Request): Promise<any> { const bytes = await readBytes(r, 2000000); try {
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (!b || typeof b !== 'object')
        throw Error();
    return b;
}
catch {
    throw new HttpError(400, 'Invalid JSON request.');
} }
async function handler(r: Request) {
    try {
        const paths = new URL(r.url).pathname.slice(5).split('/');
        const [route, pid, action, extra] = paths;
        const method = r.method;
        if (route === 'worker')
            return await worker(r, paths.slice(1));
        const u = await user(r);
        const owner = u.userId;
        const wallet = await account(owner,u.email);
        if(route==='ugc'&&pid&&action==='plan')return json(await creativePlan(owner,pid,method,method==='POST'?await body(r):{}));
        if(route==='ugc'&&pid==='renders'&&method==='GET')return json({renderEnabled:wallet.admin,renders:await ugcRenders(owner)});
        if(route==='ugc'&&pid&&action==='render'&&method==='POST')return json(await ugcRender(owner,pid,await body(r)));
        if(route==='ugc')return json(await ugcApi(method,owner,pid,method==='POST'||method==='PUT'?await body(r):{}));
        if(route==='templates')return json(await templatesApi(method,owner,pid,method==='POST'||method==='PUT'?await body(r):{}));
        if(route === "billing" || route === "admin") return json(await billingApi(route,pid,method,owner,method === "POST" ? await body(r) : {}));
        if (route === 'account') {
            if (method === 'DELETE') {
                await db().prepare('DELETE FROM clip_templates WHERE owner=?').bind(owner).run();
                await db().prepare('DELETE FROM ugc_drafts WHERE owner=?').bind(owner).run();
                const all = await db().prepare('SELECT * FROM projects WHERE owner=?').bind(owner).all();
                for (const p of all.results)
                    await removeProject(p);
                await db().batch([db().prepare('DELETE FROM imports WHERE owner=?').bind(owner), db().prepare('DELETE FROM events WHERE owner=?').bind(owner)]);
                return json({ ok: true });
            }
            const service = await db().prepare('SELECT seen FROM service_state WHERE id=?').bind('processor').first<any>();
            return json({ credits: wallet, userId: owner, name: u.fullName || u.email.split('@')[0], email: u.email, processorConfigured: !!bindings().PROCESSOR_TOKEN, processorOnline: !!service && service.seen > Date.now() - 120000 });
        }
        if (route === 'events' && method === 'POST') {
            const b = await body(r);
            if (!['visit', 'feedback'].includes(b.name) || b.name === 'feedback' && (!Number.isInteger(b.value) || b.value < 1 || b.value > 5))
                throw new HttpError(400, 'Invalid event.');
            await event(owner, b.name, b.name === 'feedback' ? b.value : null);
            return json({ ok: true });
        }
        if (route === 'projects' && !pid) {
            if (method === 'GET') {
                const list = await db().prepare('SELECT p.*, (SELECT COUNT(*) FROM clips c WHERE c.project=p.id) AS "clipCount" FROM projects p WHERE owner=? ORDER BY created DESC').bind(owner).all();
                const usage = await db().prepare('SELECT COUNT(*) AS uploads,COALESCE(SUM(seconds),0) AS seconds FROM imports WHERE owner=? AND month=?').bind(owner, new Date().toISOString().slice(0, 7)).first();
                const storage = await db().prepare(`SELECT ${storageSQL} AS bytes`).bind(owner, owner).first();
                return json({ projects: list.results.map((p: any) => ({ ...p, transcript: undefined, upload_id: undefined })), usage, storage });
            }
            if (method === 'POST') {
                let b;
                try {
                    b = validateUpload(await body(r));
                }
                catch (e) {
                    throw new HttpError(400, (e as Error).message);
                }
                const requestId = r.headers.get('Idempotency-Key');
                if (requestId && !/^[0-9a-f-]{36}$/i.test(requestId))
                    throw new HttpError(400, 'Invalid request ID.');
                const projectId = requestId || id();
                const existing = await db().prepare('SELECT id FROM projects WHERE id=? AND owner=?').bind(projectId, owner).first();
                if (existing)
                    return json({ ...existing, partSize: PART_SIZE });
                const month = new Date().toISOString().slice(0, 7);
                const now = Date.now();
                const charge = await chargeStatement(owner,projectId,b.duration);
                const out = await db().batch([db().prepare(`INSERT INTO projects(id,owner,name,size,duration,language,youtube,status,created) SELECT ?,?,?,?,?,?,?,?,? WHERE (${storageSQL})+?<=10737418240`).bind(projectId,owner,b.name,b.size,b.duration,b.language,b.youtube,'uploading',now,owner,owner,b.size),charge,db().prepare('INSERT INTO imports(id,owner,month,seconds) SELECT id,owner,?,duration FROM projects WHERE id=?').bind(month,projectId)]);
                if (!out[0].meta.changes) { await refund(projectId).run(); throw new HttpError(409,'Your 10 GB storage allowance is full.'); }
                try {
                    const upload = await bindings().BUCKET.createMultipartUpload(`${projectId}/source`, { httpMetadata: { contentType: b.name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4' } });
                    await db().prepare('UPDATE projects SET upload_id=? WHERE id=?').bind(upload.uploadId, projectId).run();
                    return json({ id: projectId, partSize: PART_SIZE }, 201);
                }
                catch (e) {
                    await db().batch([refund(projectId),db().prepare('DELETE FROM projects WHERE id=?').bind(projectId), db().prepare('DELETE FROM imports WHERE id=?').bind(projectId)]);
                    throw e;
                }
            }
        }
        if(route==='projects' && pid==='youtube' && method==='POST'){
            const b=await body(r);let url;try{url=youtubeVideo(b.url)}catch(e){throw new HttpError(400,(e as Error).message)}
            if(b.rights!==true||!['auto','en','id'].includes(b.language))throw new HttpError(400,'Confirm permission and choose a supported language.');
            const key=r.headers.get('Idempotency-Key');if(!key||!/^[0-9a-f-]{36}$/i.test(key))throw new HttpError(400,'Missing import request ID.');
            const existing=await db().prepare('SELECT id FROM projects WHERE id=? AND owner=?').bind(key,owner).first();if(existing)return json(existing);
            if(!wallet.unlimited&&wallet.free+wallet.paid<1)throw new HttpError(402,'No credits available. Wait for reset or request a subscription.');
            const inserted=await db().batch([db().prepare(`INSERT INTO projects(id,owner,name,size,duration,language,youtube,status,created) SELECT ?,?,?,2147483648,60,?,?,'downloading',? WHERE (${storageSQL})+2147483648<=10737418240`).bind(key,owner,'YouTube video',b.language,url,Date.now(),owner,owner), db().prepare('INSERT INTO jobs(id,project,kind,payload,created) SELECT id,id,?,?,? FROM projects WHERE id=?').bind('transcribe',JSON.stringify({youtube:url}),Date.now(),key)]);
            if(!inserted[0].meta.changes)throw new HttpError(409,'YouTube import needs 2 GB of available storage.');
            return json({id:key},201);
        }
        if (route === 'projects' && pid) {
            const p = !action && method === 'DELETE' ? await db().prepare('SELECT * FROM projects WHERE id=? AND owner=?').bind(pid,owner).first<any>() : await project(pid, owner);
            if (!p) throw new HttpError(404, 'Project not found.');
            if (!action && method === 'GET') {
                const clips = await db().prepare('SELECT * FROM clips WHERE project=? ORDER BY created').bind(pid).all();
                const jobs = await db().prepare('SELECT id,clip,kind,status,progress,error,size,created FROM jobs WHERE project=? ORDER BY created DESC').bind(pid).all();
                return json({ ...p, upload_id: undefined, transcript: JSON.parse(p.transcript), clips: clips.results.map((c: any) => ({ ...c, data: JSON.parse(c.data) })), jobs: jobs.results });
            }
            if (!action && method === 'DELETE') {
                await removeProject(p);
                return json({ ok: true });
            }
            if (action === 'part' && method === 'POST') {
                if (p.status !== 'uploading')
                    throw new HttpError(409, 'This upload is no longer active.');
                const n = Number(extra);
                const expected = Math.min(PART_SIZE, p.size - (n - 1) * PART_SIZE);
                if (!Number.isInteger(n) || n < 1 || expected <= 0)
                    throw new HttpError(400, 'Invalid upload part.');
                const chunk = await body(r);
                if (chunk.size !== expected)
                    throw new HttpError(400, 'Upload part has the wrong size.');
                const part = await bindings().BUCKET.resumeMultipartUpload(`${pid}/source`, p.upload_id).signPart(n, chunk.size);
                return json(part);
            }
            if (action === 'complete' && method === 'POST') {
                if (p.status !== 'uploading')
                    return json({ ok: true });
                const b = await body(r);
                if (!Array.isArray(b.parts) || b.parts.length !== Math.ceil(p.size / PART_SIZE) || b.parts.some((x: any, i: number) => x.partNumber !== i + 1 || typeof x.etag !== 'string'))
                    throw new HttpError(400, 'Upload is incomplete.');
                if (!await bindings().BUCKET.head(`${pid}/source`))
                    await bindings().BUCKET.resumeMultipartUpload(`${pid}/source`, p.upload_id).complete(b.parts, p.size);
                const head = await bindings().BUCKET.head(`${pid}/source`);
                if (head?.size !== p.size)
                    throw new HttpError(400, 'Uploaded file size does not match.');
                await db().batch([db().prepare('UPDATE projects SET status=?,upload_id=NULL WHERE id=?').bind('queued', pid), db().prepare('INSERT INTO jobs(id,project,kind,created) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(pid, pid, 'transcribe', Date.now())]);
                await event(owner, 'upload_complete');
                return json({ ok: true });
            }
            if (action === 'source' && method === 'GET')
                return media(r, `${pid}/source`,new URL(r.url).searchParams.get('download')==='1'?'loofyai-product.mp4':undefined);
            if (action === 'retry' && method === 'POST') {
                if (p.status !== 'failed')
                    throw new HttpError(409, 'Only failed processing can be retried.');
                const retryJob=await db().prepare('SELECT payload FROM jobs WHERE id=?').bind(pid).first<any>();
                if(retryJob&&JSON.parse(retryJob.payload).ugc){
                    if(!wallet.admin)throw new HttpError(403,'Administrator access required.');
                    return db().transaction(async()=>{
                    await db().prepare('SELECT id FROM accounts WHERE id=? FOR UPDATE').bind(owner).first();
                    const active=await db().prepare("SELECT j.id FROM jobs j JOIN projects p ON p.id=j.project WHERE p.owner=? AND j.payload::jsonb->'ugc' IS NOT NULL AND j.status IN ('queued','running')").bind(owner).first();
                    if(active)throw new HttpError(409,'Wait for the active UGC render to finish.');
                    await db().prepare("UPDATE projects SET size=134217728,status='queued',error=NULL WHERE id=?").bind(pid).run();
                    await db().prepare("UPDATE jobs SET status='queued',attempts=0,lease=0,error=NULL,progress=0,token=NULL WHERE id=?").bind(pid).run();return json({ok:true});});
                }
                if(retryJob&&JSON.parse(retryJob.payload).youtube){
                    const reserved=await db().prepare(`UPDATE projects SET size=2147483648 WHERE id=? AND (${storageSQL})-?+2147483648<=10737418240`).bind(pid,owner,owner,p.size).run();
                    if(!reserved.meta.changes)throw new HttpError(409,'YouTube retry needs 2 GB of available storage.');
                }
                const oldCharge=await db().prepare('SELECT refunded FROM credit_ledger WHERE project=?').bind(pid).first<any>();
                if(oldCharge?.refunded){const charge=await chargeStatement(owner,pid,p.duration);await db().batch([db().prepare('DELETE FROM credit_ledger WHERE project=? AND refunded=1').bind(pid),charge]);}
                await db().batch([db().prepare('UPDATE projects SET status=?,error=NULL WHERE id=?').bind('queued', pid), db().prepare('UPDATE jobs SET status=?,error=NULL,attempts=0,lease=0,token=NULL WHERE id=?').bind('queued', pid)]);
                return json({ ok: true });
            }
            if (action === 'transcript' && method === 'PUT') {
                const b = await body(r);
                const original = JSON.parse(p.transcript);
                if (!Array.isArray(b.words) || b.words.length !== original.length || b.words.some((w: any) => typeof w !== 'string' || w.length > 250))
                    throw new HttpError(400, 'Invalid transcript edits.');
                await db().prepare('UPDATE projects SET transcript=? WHERE id=?').bind(JSON.stringify(original.map((w: any, i: number) => ({ ...w, text: b.words[i] }))), pid).run();
                return json({ ok: true });
            }
            if(action==='suggestions' && method==='POST'){
                if(p.status!=='ready')throw new HttpError(409,'Wait for the transcript before suggesting clips.');
                const suggestions=suggestHighlights(JSON.parse(p.transcript),p.duration,p.language);
                await db().batch([db().prepare('DELETE FROM clips WHERE project=? AND suggested=1 AND id NOT IN (SELECT clip FROM jobs WHERE clip IS NOT NULL)').bind(pid),...suggestions.map((s:any)=>db().prepare('INSERT INTO clips(id,project,data,suggested,created) VALUES(?,?,?,?,?)').bind(id(),pid,JSON.stringify({...s,position:50}),1,Date.now()))]);return json({count:suggestions.length});
            }
            if (action === 'clips' && method === 'POST') {
                if (['uploading', 'deleting'].includes(p.status))
                    throw new HttpError(409, 'Finish uploading the video before editing.');
                let b;
                try {
                    b = validateClip(await body(r), p.duration);
                }
                catch (e) {
                    throw new HttpError(400, (e as Error).message);
                }
                const cid = id();
                await db().prepare('INSERT INTO clips(id,project,data,created) VALUES(?,?,?,?)').bind(cid, pid, JSON.stringify(b), Date.now()).run();
                await event(owner, 'clip_created');
                return json({ id: cid, data: b }, 201);
            }
        }
        if (route === 'clips' && pid) {
            const c = await db().prepare('SELECT * FROM clips WHERE id=?').bind(pid).first<any>();
            if (!c)
                throw new HttpError(404, 'Clip not found.');
            const p = await project(c.project, owner);
            if (!action && method === 'PUT') {
                let b;
                try {
                    b = validateClip(await body(r), p.duration);
                }
                catch (e) {
                    throw new HttpError(400, (e as Error).message);
                }
                await db().prepare('UPDATE clips SET data=?,suggested=0 WHERE id=?').bind(JSON.stringify(b), pid).run();
                if (c.suggested)
                    await event(owner, 'suggestion_accepted');
                return json({ ok: true });
            }
            if (!action && method === 'DELETE') {
                await db().prepare('DELETE FROM clips WHERE id=?').bind(pid).run();
                return json({ ok: true });
            }
            if (action === 'export' && method === 'POST') {
                const active = await db().prepare('SELECT id FROM jobs WHERE clip=? AND status IN (?,?)').bind(pid, 'queued', 'running').first();
                if (active)
                    return json(active);
                const jid = id();
                const inserted = await db().prepare(`INSERT INTO jobs(id,project,clip,kind,payload,created,size) SELECT ?,?,?,?,?,?,1073741824 WHERE (${storageSQL})+1073741824<=10737418240 AND NOT EXISTS (SELECT 1 FROM jobs WHERE clip=? AND status IN ('queued','running')) ON CONFLICT DO NOTHING`).bind(jid, c.project, pid, 'export', JSON.stringify({ renderVersion: 3, clip: JSON.parse(c.data), words: JSON.parse(p.transcript) }), Date.now(), owner, owner, pid).run();
                if (!inserted.meta.changes) {
                    const duplicate = await db().prepare("SELECT id FROM jobs WHERE clip=? AND status IN ('queued','running')").bind(pid).first();
                    if (duplicate)
                        return json(duplicate);
                    throw new HttpError(409, 'Export needs 1 GB of available storage. Delete an old project and retry.');
                }
                return json({ id: jid }, 201);
            }
            if (action === 'describe' && method === 'POST') {
                const data = JSON.parse(c.data), words = JSON.parse(p.transcript).filter((w: any) => w.start >= data.start && w.start < data.end);
                const text = words.map((w: any) => w.text).join(' ');
                return json({ title: text.split(/\s+/).slice(0, 10).join(' ').slice(0, 150) || data.title, description: text.slice(0, 500) || data.description });
            }
        }
        if (route === 'exports' && pid && method === 'GET') {
            const j = await db().prepare('SELECT * FROM jobs WHERE id=? AND kind=? AND status=?').bind(pid, 'export', 'complete').first<any>();
            if (!j)
                throw new HttpError(404, 'Export not ready.');
            await project(j.project, owner);
            return media(r, `${j.project}/exports/${pid}.mp4`, 'loofy-clip.mp4');
        }
        throw new HttpError(404, 'Not found.');
    }
    catch (e) {
        if (e instanceof HttpError)
            return json({ error: e.message }, e.status);
        if(e instanceof Error && /Insufficient credits/.test(e.message))return json({error:'Not enough credits. Wait for the daily reset or request a subscription.'},402);
        if(e instanceof Error && /Storage quota exceeded/.test(e.message))return json({error:'Shared beta storage is full. Delete an old project or contact the administrator.'},409);
        console.error('Loofy operation failed', (e as any)?.code || 'Unknown error');
        return json({ error: 'This operation could not finish. Please retry; your saved edits are safe.' }, 500);
    }
}
async function worker(r: Request, [action, jid, sub, partNumber]: string[]) {
    const secret = bindings().PROCESSOR_TOKEN;
    if (!secret || r.headers.get('authorization') !== `Bearer ${secret}`)
        throw new HttpError(401, 'Unauthorized.');
    if(action==='ugc-plan'&&r.method==='POST')return json(await planWorker(jid,await body(r)));
    if (action === 'claim' && r.method === 'POST') {
        await db().prepare('INSERT INTO service_state(id,seen) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen').bind('processor', Date.now()).run();
        await db().prepare("UPDATE jobs SET status='failed',error='Processing was interrupted repeatedly. Please retry.' WHERE status='running' AND lease<? AND attempts>=3").bind(Date.now()).run();
        await db().prepare("UPDATE credit_ledger SET refunded=1 WHERE refunded=0 AND project IN (SELECT project FROM jobs WHERE kind='transcribe' AND status='failed')").run();
        await db().prepare("UPDATE projects SET status='failed',error='Processing was interrupted repeatedly. Please retry.' WHERE id IN (SELECT project FROM jobs WHERE kind='transcribe' AND status='failed') AND status IN ('queued','transcribing','finding highlights','downloading')").run();
        const job = await db().prepare("UPDATE jobs SET status='running',token=?,lease=?,attempts=attempts+1 WHERE id=(SELECT j.id FROM jobs j JOIN projects p ON p.id=j.project WHERE p.status<>'deleting' AND COALESCE((j.payload::jsonb->>'renderVersion')::int,1)<=? AND (j.status='queued' OR (j.status='running' AND j.lease<? AND j.attempts<3)) ORDER BY j.created LIMIT 1 FOR UPDATE OF j SKIP LOCKED) RETURNING *").bind(id(), Date.now() + 90000, r.headers.get('x-render-version')==='7'?7:r.headers.get('x-render-version')==='6'?6:r.headers.get('x-render-version')==='5'?5:r.headers.get('x-render-version')==='4'?4:r.headers.get('x-render-version')==='3'?3:r.headers.get('x-render-version')==='2'?2:1, Date.now()).first<any>();
        if (!job)
            return json({ job: null });
        const p = await db().prepare('SELECT * FROM projects WHERE id=?').bind(job.project).first<any>();
        return json({ job: { ...job, payload: JSON.parse(job.payload), projectData: { name: p.name, duration: p.duration, language: p.language } } });
    }
    return db().transaction(async () => {
    if (sub === 'finish') {
        const completed = await db().prepare("SELECT id FROM jobs WHERE id=? AND token=? AND status='complete'").bind(jid, r.headers.get('x-job-token') || '').first();
        if (completed)
            return json({ ok: true });
    }
    const job = await db().prepare("SELECT j.* FROM jobs j JOIN projects p ON p.id=j.project WHERE j.id=? AND j.token=? AND j.status='running' AND j.lease>? AND p.status<>'deleting' FOR UPDATE OF p,j").bind(jid, r.headers.get('x-job-token') || '', Date.now()).first<any>();
    if (!job)
        throw new HttpError(409, 'Job lease is no longer active.');
    if(sub==='import-prepare' && r.method==='POST'){
        const b=await body(r),p=await db().prepare('SELECT * FROM projects WHERE id=?').bind(job.project).first<any>();
        const ugc=JSON.parse(job.payload).ugc;
        if(!ugc&&!JSON.parse(job.payload).youtube)throw new HttpError(400,'Not a YouTube import.');
        if(!Number.isFinite(b.duration)||b.duration<=0||b.duration>3600)throw new HttpError(400,'YouTube videos must be at most 60 minutes.');
        const prior=await db().prepare('SELECT * FROM credit_ledger WHERE project=?').bind(p.id).first<any>();
        if(!ugc&&(!prior||prior.refunded)){const charge=await chargeStatement(p.owner,p.id,b.duration);await db().batch([db().prepare('DELETE FROM credit_ledger WHERE project=? AND refunded=1').bind(p.id),charge]);}
        if(p.upload_id)try{await bindings().BUCKET.resumeMultipartUpload(`${p.id}/source`,p.upload_id).abort()}catch{}
        const upload=await bindings().BUCKET.createMultipartUpload(`${p.id}/source`,{httpMetadata:{contentType:'video/mp4'}});
        await db().prepare('UPDATE projects SET duration=?,name=?,upload_id=? WHERE id=?').bind(b.duration,String(b.name||'YouTube video').slice(0,190),upload.uploadId,p.id).run();return json({ok:true});
    }
    if(sub==='import-part' && r.method==='POST'){
        const p=await db().prepare('SELECT upload_id FROM projects WHERE id=?').bind(job.project).first<any>(),n=Number(partNumber);
        if(!p.upload_id||!Number.isInteger(n)||n<1||n>256)throw new HttpError(400,'Invalid source part.');
        return json(await bindings().BUCKET.resumeMultipartUpload(`${job.project}/source`,p.upload_id).signPart(n,(await body(r)).size));
    }
    if(sub==='import-complete' && r.method==='POST'){
        const b=await body(r),p=await db().prepare('SELECT * FROM projects WHERE id=?').bind(job.project).first<any>();
        if(!Array.isArray(b.parts)||!b.parts.length||b.parts.length>256||b.parts.some((v:any,i:number)=>v.partNumber!==i+1||typeof v.etag!=='string'))throw new HttpError(400,'Invalid source parts.');
        if(p.upload_id)await bindings().BUCKET.resumeMultipartUpload(`${p.id}/source`,p.upload_id).complete(b.parts);
        const object=await bindings().BUCKET.head(`${p.id}/source`);if(!object||object.size>(JSON.parse(job.payload).ugc?134217728:2147483648))throw new HttpError(400,'Source exceeds 2 GB.');
        await db().prepare('UPDATE projects SET size=?,upload_id=NULL WHERE id=?').bind(object.size,p.id).run();return json({ok:true});
    }
    if (sub === 'source' && r.method === 'GET')
        return json({url: await bindings().BUCKET.signedGet(`${job.project}/source`)});
    if (sub === 'heartbeat' && r.method === 'POST') {
        const b = await body(r);
        await db().prepare('UPDATE service_state SET seen=? WHERE id=?').bind(Date.now(), 'processor').run();
        await db().prepare('UPDATE jobs SET lease=?,progress=? WHERE id=? AND token=?').bind(Date.now() + 90000, Math.floor(Math.max(0, Math.min(99, Number(b.progress) || 0))), jid, job.token).run();
        if (job.kind === 'transcribe' && ['downloading','transcribing', 'finding highlights'].includes(b.stage))
            await db().prepare('UPDATE projects SET status=? WHERE id=?').bind(b.stage, job.project).run();
        return json({ ok: true });
    }
    if (sub === 'output-start' && r.method === 'POST') {
        if (job.kind !== 'export')
            throw new HttpError(400, 'Wrong job kind.');
        const payload = JSON.parse(job.payload);
        if (payload.uploadId)
            try {
                await bindings().BUCKET.resumeMultipartUpload(`${job.project}/exports/${jid}.mp4`, payload.uploadId).abort();
            }
            catch { }
        const upload = await bindings().BUCKET.createMultipartUpload(`${job.project}/exports/${jid}.mp4`, { httpMetadata: { contentType: 'video/mp4' } });
        await db().prepare('UPDATE jobs SET payload=? WHERE id=?').bind(JSON.stringify({ ...payload, uploadId: upload.uploadId }), jid).run();
        return json({ ok: true });
    }
    if (sub === 'output-part' && r.method === 'POST') {
        const n = Number(partNumber), payload = JSON.parse(job.payload);
        if (!payload.uploadId || !Number.isInteger(n) || n < 1 || n > 128)
            throw new HttpError(400, 'Invalid export part.');
        const chunk = await body(r);
        if (!Number.isInteger(chunk.size) || chunk.size < 1 || chunk.size > PART_SIZE)
            throw new HttpError(400, 'Empty export part.');
        return json(await bindings().BUCKET.resumeMultipartUpload(`${job.project}/exports/${jid}.mp4`, payload.uploadId).signPart(n, chunk.size));
    }
    if (sub === 'output-complete' && r.method === 'POST') {
        if (await bindings().BUCKET.head(`${job.project}/exports/${jid}.mp4`))
            return json({ ok: true });
        const b = await body(r), payload = JSON.parse(job.payload);
        if (!payload.uploadId || !Array.isArray(b.parts) || !b.parts.length || b.parts.length > 128 || b.parts.some((x: any, i: number) => x.partNumber !== i + 1 || typeof x.etag !== 'string'))
            throw new HttpError(400, 'Invalid export parts.');
        await bindings().BUCKET.resumeMultipartUpload(`${job.project}/exports/${jid}.mp4`, payload.uploadId).complete(b.parts);
        return json({ ok: true });
    }
    if (sub === 'finish' && r.method === 'POST') {
        const b = await body(r);
        const p = await db().prepare('SELECT * FROM projects WHERE id=?').bind(job.project).first<any>();
        if (b.error) {
            const payload = JSON.parse(job.payload);
            if(payload.youtube||payload.ugc){
                if(p.upload_id)try{await bindings().BUCKET.resumeMultipartUpload(`${p.id}/source`,p.upload_id).abort()}catch{}
                const source=await bindings().BUCKET.head(`${p.id}/source`);
                await db().prepare('UPDATE projects SET size=?,upload_id=NULL WHERE id=?').bind(source?.size||0,p.id).run();
            }
            if (payload.uploadId)
                try {
                    await bindings().BUCKET.resumeMultipartUpload(`${job.project}/exports/${jid}.mp4`, payload.uploadId).abort();
                }
                catch { }
            await db().batch([...(job.kind==='transcribe'?[refund(job.project)]:[]),db().prepare('UPDATE jobs SET status=?,error=? WHERE id=?').bind('failed', String(b.error).slice(0, 500), jid), ...(job.kind === 'transcribe' ? [db().prepare('UPDATE projects SET status=?,error=? WHERE id=?').bind('failed', String(b.error).slice(0, 500), p.id)] : [])]);
            await event(p.owner, job.kind === 'export' ? 'export_failed' : 'processing_failed');
            return json({ ok: true });
        }
        if (job.kind === 'transcribe' && JSON.parse(job.payload).ugc) {
            const data=JSON.parse(job.payload).ugc,object=await bindings().BUCKET.head(job.project+'/source');
            if(!object||object.size>134217728)throw new HttpError(409,'Upload the rendered source before finishing.');
            const clip={title:data.title,description:data.script,start:0,end:p.duration,ratio:data.ratio,fit:'contain',position:50,captions:false,fontSize:36,color:'#ffffff',background:'#000000',captionText:null};
            await db().prepare("UPDATE projects SET status='ready',error=NULL WHERE id=?").bind(p.id).run();
            await db().prepare('INSERT INTO clips(id,project,data,suggested,created) VALUES(?,?,?,0,?) ON CONFLICT DO NOTHING').bind(p.id+'-clip',p.id,JSON.stringify(clip),Date.now()).run();
        }
        else if (job.kind === 'transcribe') {
            if (!['en', 'id'].includes(b.language) || !Number.isFinite(b.duration) || b.duration > 3600 || b.duration > p.duration + 1 || !Array.isArray(b.words) || b.words.length > 30000 || b.words.some((w: any) => typeof w.text !== 'string' || w.text.length > 250 || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end < w.start || w.end > b.duration + 1))
                throw new HttpError(400, 'Invalid transcription result.');
            const suggestions = suggestHighlights(b.words, b.duration,b.language);
            const statements = [db().prepare('UPDATE projects SET transcript=?,duration=?,language=?,status=?,error=NULL WHERE id=?').bind(JSON.stringify(b.words), b.duration, b.language, b.words.length ? 'ready' : 'no_speech', p.id), db().prepare('DELETE FROM clips WHERE project=? AND suggested=1').bind(p.id), ...suggestions.map((s: any) => db().prepare('INSERT INTO clips(id,project,data,suggested,created) VALUES(?,?,?,?,?)').bind(id(), p.id, JSON.stringify({ ...s, position: 50 }), 1, Date.now()))];
            statements.push(db().prepare("UPDATE jobs SET status='complete',progress=100,lease=0 WHERE id=?").bind(jid));
            await db().batch(statements);
            await event(p.owner, 'processing_complete');
        }
        else {
            const object = await bindings().BUCKET.head(`${job.project}/exports/${jid}.mp4`);
            if (!object)
                throw new HttpError(409, 'Upload the export before finishing.');
            await db().prepare('UPDATE jobs SET size=? WHERE id=?').bind(object.size, jid).run();
            await event(p.owner, 'export_complete');
        }
        await db().prepare('UPDATE jobs SET status=?,progress=100,lease=0 WHERE id=?').bind('complete', jid).run();
        return json({ ok: true });
    }
    throw new HttpError(404, 'Unknown worker operation.');
    });
}
export const GET = handler, POST = handler, PUT = handler, DELETE = handler;
