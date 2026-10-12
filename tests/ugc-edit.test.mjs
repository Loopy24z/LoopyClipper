import test from 'node:test';
import assert from 'node:assert/strict';
import {makeProductEdit} from '../lib/ugc-edit.mjs';
import {validateUgcDraft} from '../lib/ugc-domain.mjs';
test('quick edits preserve every word and create bounded exportable scenes',()=>{
 for(const count of [1,17,76,120])for(const preset of ['punchy','calm','showcase']){
 const script=Array.from({length:count},(_,i)=>'word'+i).join(' '),edit=makeProductEdit(script,preset);
 assert.equal(edit.scenes.map(s=>s.narration).join(' '),script);
 assert.ok(edit.scenes.length<=8);assert.ok(edit.scenes.reduce((sum,s)=>sum+s.seconds,0)<=60);
 const draft={title:'Test',product:'',script,mode:'product',language:'id',style:'natural',ratio:'9:16',duration:15,rights:false,image:'',...edit};
 assert.deepEqual(validateUgcDraft(draft),draft);
 }
 assert.throws(()=>makeProductEdit(''));assert.throws(()=>makeProductEdit('word '.repeat(121)));
});

test('ad editing creates a short opening, varied layouts and closing hold without invented copy',()=>{
 const script='Lihat produk ini lebih dekat. Desain ringkas untuk dibawa saat bepergian. Pilih warna yang sesuai dengan gaya Anda. Baca detail produk sebelum membeli.';
 const {scenes}=makeProductEdit(script,'showcase');
 assert.ok(scenes[0].seconds<=3);assert.equal(scenes[0].layout,'hero');
 assert.equal(scenes.at(-1).layout,'cta');assert.equal(scenes.at(-1).motion,'still');
 assert.ok(new Set(scenes.map(s=>s.layout)).size>=3);
 assert.equal(scenes.map(s=>s.narration).join(' '),script);
 for(const scene of scenes){assert.ok(scene.narration.startsWith(scene.displayText));assert.equal(scene.framing,'fit');}
});
