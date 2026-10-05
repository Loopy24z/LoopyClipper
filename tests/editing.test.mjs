import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pauseCuts,editedDuration,sourceTime,outputTime,captionGroup} from '../lib/editing.mjs';
import {validateClip} from '../lib/domain.mjs';
import {openingHook,fundamentalSettings,headlineFromWords} from '../lib/editing.mjs';
const clip={title:'Test',description:'',start:0,end:10,ratio:'9:16',fit:'cover',position:50,captions:true,fontSize:36,color:'#ffffff',background:'#000000'};
test('cuts preserve speech padding and output/source time mapping',()=>{
 const words=[{start:0,end:2,text:'First.'},{start:4,end:6,text:'Next'},{start:6.1,end:9.8,text:'sentence.'}];
 const segments=pauseCuts(words,clip,'balanced');assert.equal(segments.length,2);
 assert.ok(segments[0].end>2&&segments[1].start<4);
 const edited={...clip,segments};assert.ok(editedDuration(edited)<9);
 for(const time of [0,1,4,6,9])assert.ok(Math.abs(sourceTime(edited,outputTime(edited,time))-time)<1e-8);
 assert.deepEqual(pauseCuts([],clip,'tight'),[{start:0,end:10}]);
 assert.equal(pauseCuts(words,clip,'off').length,1);
 assert.equal(captionGroup(words,edited,3).length,0);
 assert.equal(captionGroup(words,edited,5)[0].text,'Next');
 assert.ok(captionGroup(words,{...edited,wordsPerCaption:0},5).length>0,'in-progress invalid input cannot freeze playback');
});
test('rejects invalid segment payloads and caption layout',()=>{
 for(const segments of [[],[{start:0,end:4},{start:3,end:5}],[{start:-1,end:1}],[{start:0,end:11}]])assert.throws(()=>validateClip({...clip,segments},10));
 for(const wordsPerCaption of [0,7,1.5])assert.throws(()=>validateClip({...clip,wordsPerCaption},10));
 assert.equal(validateClip({...clip,textEffect:'highlight',wordsPerCaption:1},10).textEffect,'highlight');
 assert.equal(validateClip(clip,10).segments,undefined);
});
test('hook scoring looks only at opening 3 seconds and headline quotes source words',()=>{
 const words=[{start:0,end:1,text:'Halo'},{start:1,end:2,text:'semuanya.'},{start:4,end:5,text:'Kenapa'},{start:5,end:6,text:'salah?'}];
 assert.equal(openingHook(words,0,10).signal,'speech');
 assert.equal(openingHook(words,4,10).signal,'question');
 assert.ok(openingHook(words,4,10).score>openingHook(words,0,10).score);
 assert.equal(headlineFromWords(words,clip),'Halo semuanya.');
 const setup=fundamentalSettings(words,clip);
 assert.equal(setup.ratio,'9:16');assert.equal(setup.textEffect,'highlight');assert.equal(setup.headlineDuration,3);
 assert.equal(validateClip({...clip,...setup},10).headline,'Halo semuanya.');
 assert.equal(validateClip(clip,10).headlineEnabled,false,'old clips do not gain an overlay silently');
 for(const change of [{headline:'a'.repeat(81)},{headlineDuration:0},{headlineDuration:NaN},{headlineEnabled:'yes'}])assert.throws(()=>validateClip({...clip,...change},10));
});
