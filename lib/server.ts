import { appOrigin } from '@/lib/supabase/security.mjs';
import { getCurrentUser } from '@/lib/auth';
import { db as database } from './database';
import { storage } from './storage';
export const bindings = () => ({ DB: database(), BUCKET: storage, PROCESSOR_TOKEN: process.env.PROCESSOR_TOKEN, ADMIN_USER_IDS: process.env.ADMIN_USER_IDS });
export const db = database;
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export async function user(request: Request) {
    const origin = request.headers.get('origin');
    if (!['GET', 'HEAD'].includes(request.method) && (origin !== appOrigin(request.url, process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === 'production') || request.headers.get('sec-fetch-site') === 'cross-site'))
        throw new HttpError(403, 'Request origin not allowed.');
    const u = await getCurrentUser();
    if (!u)
        throw new HttpError(401, 'Sign in to continue.');
    return u;
}
export async function project(id: string, owner: string) { const p = await db().prepare('SELECT * FROM projects WHERE id=? AND owner=? AND status<>?').bind(id, owner, 'deleting').first<any>(); if (!p)
    throw new HttpError(404, 'Project not found.'); return p; }
export async function event(owner: string, name: string, value: number | null = null) { await db().prepare('INSERT INTO events(owner,name,value,created) VALUES(?,?,?,?)').bind(owner, name, value, Date.now()).run(); }
export async function removeProject(p: any) {
    if(p.status==='uploading')await db().prepare('UPDATE credit_ledger SET refunded=1 WHERE project=? AND refunded=0').bind(p.id).run();
    await db().prepare('UPDATE projects SET status=? WHERE id=?').bind('deleting', p.id).run();
    const jobs = await db().prepare('SELECT id,payload FROM jobs WHERE project=?').bind(p.id).all<any>();
    for (const j of jobs.results) {
        const payload = JSON.parse(j.payload);
        if (payload.uploadId)
            try {
                await bindings().BUCKET.resumeMultipartUpload(`${p.id}/exports/${j.id}.mp4`, payload.uploadId).abort();
            }
            catch { }
    }
    if (p.status === 'uploading')
        await db().prepare('DELETE FROM imports WHERE id=?').bind(p.id).run();
    if (p.upload_id)
        try {
            await bindings().BUCKET.resumeMultipartUpload(`${p.id}/source`, p.upload_id).abort();
        }
        catch { }
    let cursor: string | undefined;
    do {
        const list = await bindings().BUCKET.list({ prefix: p.id + '/', cursor });
        if (list.objects.length)
            await bindings().BUCKET.delete(list.objects.map(o => o.key));
        cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    await db().batch([db().prepare('DELETE FROM jobs WHERE project=?').bind(p.id), db().prepare('DELETE FROM clips WHERE project=?').bind(p.id), db().prepare('DELETE FROM projects WHERE id=?').bind(p.id)]);
}
export async function media(request: Request, key: string, name?: string) {
    if (!await storage.head(key)) throw new HttpError(404, 'Media not found.');
    return new Response(null, { status: 307, headers: { Location: await storage.signedGet(key, name), 'Cache-Control': 'private, no-store' } });
}
