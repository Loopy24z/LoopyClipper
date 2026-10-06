import test from 'node:test';
import assert from 'node:assert/strict';
import {makeProductEdit} from '../lib/ugc-edit.mjs';
import {validateUgcDraft} from '../lib/ugc-domain.mjs';
test('quick edits preserve every word and create bounded exportable scenes',()=>{
 for(const count of [1,17,76,120])for(const preset of ['punchy','calm']){
 const script=Array.from({length:count},(_,i)=>'word'+i).join(' '),edit=makeProductEdit(script,preset);
 assert.equal(edit.scenes.map(s=>s.narration).join(' '),script);
 assert.ok(edit.scenes.length<=8);assert.ok(edit.scenes.reduce((sum,s)=>sum+s.seconds,0)<=60);
 const draft={title:'Test',product:'',script,mode:'product',language:'id',style:'natural',ratio:'9:16',duration:15,rights:false,image:'',...edit};
 assert.deepEqual(validateUgcDraft(draft),draft);
 }
 assert.throws(()=>makeProductEdit(''));assert.throws(()=>makeProductEdit('word '.repeat(121)));
});
