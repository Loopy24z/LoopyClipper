import {db,HttpError} from './server';
import {templateSettings} from './template-settings.mjs';
export async function templatesApi(method:string,owner:string,id:string|undefined,body:any){
 if(method==='GET')return {templates:(await db().prepare('SELECT id,name,settings,updated FROM clip_templates WHERE owner=? ORDER BY updated DESC').bind(owner).all<any>()).results.map(row=>({...row,settings:JSON.parse(row.settings)}))};
 if(method==='DELETE'&&id){const result=await db().prepare('DELETE FROM clip_templates WHERE id=? AND owner=?').bind(id,owner).run();if(!result.meta.changes)throw new HttpError(404,'Template not found.');return {ok:true};}
 if(method!=='POST'&&method!=='PUT')throw new HttpError(405,'Method not allowed.');
 if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>50)throw new HttpError(400,'Name your template using up to 50 characters.');
 let settings;try{settings=templateSettings(body.settings)}catch{throw new HttpError(400,'Check your caption and frame settings before saving a template.');}
 const name=body.name.trim(),serialized=JSON.stringify(settings),updated=Date.now();
 try{
  if(method==='PUT'){
   const result=await db().prepare('UPDATE clip_templates SET name=?,settings=?,updated=? WHERE id=? AND owner=?').bind(name,serialized,updated,id||'',owner).run();
   if(!result.meta.changes)throw new HttpError(404,'Template not found.');
   return {id,name,settings,updated};
  }
  return await db().transaction(async()=>{
   await db().prepare('SELECT id FROM accounts WHERE id=? FOR UPDATE').bind(owner).first();
   const count=await db().prepare('SELECT COUNT(*) AS count FROM clip_templates WHERE owner=?').bind(owner).first<any>();
   if(Number(count?.count)>=20)throw new HttpError(409,'You have 20 templates. Replace or delete one first.');
   const newId=crypto.randomUUID();await db().prepare('INSERT INTO clip_templates(id,owner,name,settings,updated) VALUES(?,?,?,?,?)').bind(newId,owner,name,serialized,updated).run();
   return {id:newId,name,settings,updated};
  });
 }catch(error){if((error as any)?.code==='23505')throw new HttpError(409,'A template with that name already exists. Choose another name or replace it.');throw error;}
}
