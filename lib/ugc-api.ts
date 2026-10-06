import {db,HttpError} from './server';
import {isAdmin} from './credits';
import {ugcRenders} from './ugc-render';
import {validateUgcDraft} from './ugc-domain.mjs';
export async function ugcApi(method:string,owner:string,id:string|undefined,body:any){
 if(method==='GET')return {generationEnabled:false,renderEnabled:isAdmin(owner),renders:await ugcRenders(owner),drafts:(await db().prepare('SELECT id,data,updated FROM ugc_drafts WHERE owner=? ORDER BY updated DESC').bind(owner).all<any>()).results.map(row=>({...row,data:JSON.parse(row.data)}))};
 if(method==='DELETE'&&id){const result=await db().prepare('DELETE FROM ugc_drafts WHERE id=? AND owner=?').bind(id,owner).run();if(!result.meta.changes)throw new HttpError(404,'Draft not found.');return {ok:true};}
 if(method!=='POST'&&method!=='PUT')throw new HttpError(405,'Method not allowed.');
 let data;try{data=validateUgcDraft(body)}catch(e){throw new HttpError(400,(e as Error).message);}
 const updated=Date.now();
 if(method==='PUT'){
  const result=await db().prepare('UPDATE ugc_drafts SET data=?,updated=? WHERE id=? AND owner=?').bind(JSON.stringify(data),updated,id||'',owner).run();
  if(!result.meta.changes)throw new HttpError(404,'Draft not found.');return {id,data,updated};
 }
 return db().transaction(async()=>{
  await db().prepare('SELECT id FROM accounts WHERE id=? FOR UPDATE').bind(owner).first();
  const count=await db().prepare('SELECT COUNT(*) AS count FROM ugc_drafts WHERE owner=?').bind(owner).first<any>();
  if(Number(count?.count)>=20)throw new HttpError(409,'You have 20 drafts. Delete one before creating another.');
  const newId=crypto.randomUUID();await db().prepare('INSERT INTO ugc_drafts(id,owner,data,updated) VALUES(?,?,?,?)').bind(newId,owner,JSON.stringify(data),updated).run();
  return {id:newId,data,updated};
 });
}
