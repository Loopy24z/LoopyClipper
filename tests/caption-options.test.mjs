import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateClip,suggestHighlights} from '../lib/domain.mjs';
const base={title:'Test',description:'',start:0,end:20,ratio:'9:16',fit:'contain',position:50,captions:true,fontSize:36,color:'#ffffff',background:'#000000'};
test('font and effects survive validation with compatible defaults',()=>{assert.equal(validateClip(base,60).font,'sans');for(const font of ['sans','serif','mono'])for(const textEffect of ['box','outline','shadow','bold'])assert.equal(validateClip({...base,font,textEffect},60).textEffect,textEffect);assert.throws(()=>validateClip({...base,font:'unsafe,font'},60));});
test('90 second speech yields multiple explained distinct clips',()=>{const words=Array.from({length:180},(_,i)=>({start:i*.5,end:i*.5+.4,text:i%20===0?'How?':'example.'}));const clips=suggestHighlights(words,90,'en');assert.ok(clips.length>=2);for(let i=0;i<clips.length;i++){assert.ok(clips[i].reason.length>30);assert.ok(clips[i].end-clips[i].start>=15);if(i)assert.ok(clips[i].start>=clips[i-1].end);}});
