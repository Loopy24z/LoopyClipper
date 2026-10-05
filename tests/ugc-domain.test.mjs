import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUgcDraft} from '../lib/ugc-domain.mjs';
const draft={title:'Campaign',product:'Product',script:'Hello',mode:'product',language:'id',style:'natural',ratio:'9:16',duration:10,rights:false,image:''};
test('UGC drafts validate inputs and never retain provider or ownership fields',()=>{
 assert.deepEqual(validateUgcDraft({...draft,owner:'other',generationEnabled:true}),draft);
 for(const change of [{title:''},{script:'x'.repeat(3001)},{duration:90},{language:'xx'},{rights:'true'},{image:'https://example.com/image.jpg'},{image:'data:image/svg+xml;base64,AAAA'},{image:'data:image/jpeg;base64,AAAA'},{image:'x'.repeat(220001)}])assert.throws(()=>validateUgcDraft({...draft,...change}));
 assert.equal(validateUgcDraft({...draft,mode:'presenter',language:'en',ratio:'16:9',duration:15}).mode,'presenter');
});
