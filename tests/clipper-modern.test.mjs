import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestHighlights,validateClip} from '../lib/domain.mjs';
import {captionGroups,captionMotion,pauseCuts} from '../lib/editing.mjs';
import {templateSettings} from '../lib/template-settings.mjs';
const base={title:'Test',description:'',start:0,end:60,ratio:'9:16',fit:'cover',position:50,captions:true,fontSize:52,color:'#ffffff',background:'#000000'};
const transcript=(sentences)=>{let t=0;return sentences.flatMap(sentence=>sentence.split(' ').map(text=>{const start=t;t+=.6;return {text,start,end:t-.08}}))};
test('highlight ends follow complete thoughts and include answers after questions',()=>{
 const words=transcript(['Kenapa banyak kreator sering kesulitan membuat konten yang menarik untuk para penontonnya?', 'Karena mereka terlalu fokus pada alat dan lupa bahwa penonton membutuhkan cerita yang jelas.', 'Mulailah dengan satu masalah kemudian jelaskan langkah kecil yang bisa dicoba oleh penonton.', 'Intinya berikan manfaat nyata dan tutup pembahasan dengan satu kesimpulan yang mudah diingat.']);
 const clips=suggestHighlights(words,words.at(-1).end+.3,'id');assert.ok(clips.length);
 for(const c of clips){const inside=words.filter(w=>w.start>=c.start&&w.end<=c.end);assert.match(inside.at(-1).text,/[.!]$/);assert.doesNotMatch(inside[0].text,/^(Karena|Dan|Tapi)$/i);assert.ok(c.end-c.start>=15&&c.end-c.start<=90);}
 assert.ok(clips[0].description.includes('Karena'),'question retains explanation');
});
test('selection does not bridge a long silence into another topic',()=>{
 const words=transcript(['How can creators make an opening that keeps people interested in the story?', 'Start with one useful question and explain the answer using a clear example.', 'Remember the audience needs a complete idea rather than a collection of disconnected words.']);
 const other=words.map(w=>({...w,start:w.start+70,end:w.end+70}));
 for(const c of suggestHighlights([...words,...other],120))assert.ok(c.end<70||c.start>=69.8);
});
test('phrase grouping respects punctuation, pauses and cut boundaries',()=>{
 const words=[{text:'Hello,',start:0,end:.3},{text:'world',start:.4,end:.8},{text:'Next',start:1.4,end:1.8},{text:'idea.',start:2,end:2.4}];
 assert.deepEqual(captionGroups(words,{...base,wordsPerCaption:6}).map(g=>g.map(w=>w.text)),[['Hello,'],['world'],['Next','idea.']]);
 assert.equal(pauseCuts([{start:0,end:2,text:'Wait'},{start:2.8,end:4,text:'please.'}],{...base,end:5},'natural').length,1,'natural keeps a short thoughtful pause');
});
test('animation is seekable and persists through validation and templates',()=>{
 for(const captionAnimation of ['none','pop','rise','reveal']){assert.equal(validateClip({...base,captionAnimation},60).captionAnimation,captionAnimation);assert.equal(templateSettings({...base,captionAnimation}).captionAnimation,captionAnimation);}
 assert.throws(()=>validateClip({...base,captionAnimation:'<script>'},60));
 assert.equal(captionMotion('pop',0).scale,.88);assert.equal(captionMotion('pop',.2).scale,1);
 assert.equal(captionMotion('rise',0).opacity,0);assert.equal(captionMotion('rise',1).rise,0);
});
