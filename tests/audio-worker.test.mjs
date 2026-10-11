import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('audio worker pulls bounded PCM blocks for long stereo WAV instead of allocating full source and output PCM',async()=>{
 const frames=44100*350;let maximumRequest=0,requests=0,context;
 const output=new Promise((resolve,reject)=>{
  const self={postMessage(message){
   if(message.error){reject(Error(message.error));return;}
   if(message.blob){resolve(message.blob);return;}
   if(message.need){const {start,end}=message.need;maximumRequest=Math.max(maximumRequest,end-start);requests++;
    const channels=[new Float32Array(end-start).fill(.25),new Float32Array(end-start).fill(-.25)];
    queueMicrotask(()=>void context.self.onmessage({data:{type:'samples',channels}}));
   }
  }};
  context=vm.createContext({self,Blob,ArrayBuffer,DataView,Int16Array,Uint8Array,Float32Array});
  vm.runInContext(readFileSync(new URL('../public/audio/convert-worker.js',import.meta.url),'utf8'),context);
  void context.self.onmessage({data:{type:'start',channelCount:2,frames,sampleRate:44100,speed:1,gain:0,format:'wav',bitrate:128}});
 });
 const blob=await output;assert.equal(blob.size,44+frames*4);assert.ok(requests>900);assert.ok(maximumRequest<=16385);
 const bytes=new DataView(await blob.arrayBuffer());assert.equal(bytes.getUint32(40,true),frames*4);
 for(const sample of [0,16383,16384,frames-1]){assert.equal(bytes.getInt16(44+sample*4,true),8192);assert.equal(bytes.getInt16(46+sample*4,true),-8192);}
});
