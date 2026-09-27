import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUpload, validateClip, suggestHighlights } from '../lib/domain.mjs';
test('upload validates rights, format, limits and source URL',()=>{
 const base={name:'talk.mp4',size:1000,duration:60,rights:true,language:'en',youtube:''};
 assert.equal(validateUpload(base).name,'talk.mp4');
 for(const change of [{rights:false},{size:2147483649},{duration:3601},{name:'file.exe'},{youtube:'https://evil.example'},{duration:NaN}]) assert.throws(()=>validateUpload({...base,...change}));
});
test('clip validates timeline, captions and crop',()=>{
 const clip={title:'Test',description:'A moment',start:2,end:22,ratio:'9:16',fit:'contain',position:50,captions:true,fontSize:36,color:'#ffffff',background:'#000000'};
 assert.equal(validateClip(clip,60).end,22);
 for(const change of [{end:61},{start:22},{ratio:'4:3'},{color:'red;exec'},{position:101}]) assert.throws(()=>validateClip({...clip,...change},60));
});
test('suggestions are distinct and absent on silence',()=>{
 assert.deepEqual(suggestHighlights([],100),[]);
 const words=Array.from({length:150},(_,i)=>({start:i,end:i+.8,text:i%20===0?'Why?':'word'}));
 const clips=suggestHighlights(words,150);assert.ok(clips.length>0&&clips.length<=5);
 for(const c of clips) assert.ok(c.end-c.start>=15&&c.end-c.start<=90);
 for(let i=1;i<clips.length;i++) assert.ok(clips[i].start>=clips[i-1].end);
});
