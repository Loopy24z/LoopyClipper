import {test} from 'node:test';import assert from 'node:assert/strict';
import {validatePublication,publicationLink} from '../lib/publishing-domain.mjs';
const clip={start:0,end:30,ratio:'9:16'},post={platform:'youtube',title:'Title',description:'Details',privacy:'private',madeForKids:false,synthetic:false,consent:true};
test('publishing requires explicit consent, chosen visibility and a supported destination',()=>{
 assert.equal(validatePublication(post,clip).privacy,'private');
 for(const v of [{consent:false},{privacy:''},{platform:'tiktok'},{title:'<test>'},{madeForKids:undefined}])assert.throws(()=>validatePublication({...post,...v},clip));
 assert.throws(()=>validatePublication({...post,platform:'facebook',privacy:'public'},{...clip,ratio:'16:9'}));
 assert.throws(()=>validatePublication({...post,platform:'facebook',privacy:'public'},{...clip,end:95}));
 assert.equal(validatePublication({...post,platform:'instagram',privacy:'public'},clip).privacy,'public');
 assert.equal(publicationLink('youtube','abc_123'),'https://www.youtube.com/watch?v=abc_123');
 assert.equal(publicationLink('youtube','javascript:alert(1)'),null);
});
