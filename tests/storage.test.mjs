import {test} from 'node:test';
import assert from 'node:assert/strict';
import {S3Client} from '@aws-sdk/client-s3';
import {storage} from '../lib/storage.ts';
test('R2 completes only matching server-reported parts and signs private constrained requests',async t=>{
 const names=['R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{R2_ACCOUNT_ID:'testaccount',R2_BUCKET:'test-bucket',R2_ACCESS_KEY_ID:'test-key',R2_SECRET_ACCESS_KEY:'test-secret'});
 t.after(()=>{for(const k of names){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k]}});
 let completed=0;
 const send=S3Client.prototype.send;
 S3Client.prototype.send=async command=>{
  if(command.constructor.name==='ListPartsCommand')return {Parts:[{PartNumber:1,ETag:'"etag"',Size:1000}]};
  if(command.constructor.name==='CompleteMultipartUploadCommand'){completed++;return {}};
  throw new Error('Unexpected command');
 };
 t.after(()=>S3Client.prototype.send=send);
 const upload=storage.resumeMultipartUpload('project/source','upload-id');
 await assert.rejects(upload.complete([{partNumber:1,etag:'"wrong"'}],1000),/do not match/);
 await assert.rejects(upload.complete([{partNumber:1,etag:'"etag"'}],999),/do not match/);
 assert.equal(completed,0);
 await upload.complete([{partNumber:1,etag:'"etag"'}],1000);assert.equal(completed,1);
 const signed=new URL((await upload.signPart(1,1000)).url);
 assert.equal(signed.protocol,'https:');assert.equal(signed.searchParams.get('X-Amz-Expires'),'900');
 assert.ok(signed.searchParams.get('X-Amz-SignedHeaders').includes('content-length'));
 await assert.rejects(upload.signPart(1,8*1024**2+1),/Invalid/);
});
