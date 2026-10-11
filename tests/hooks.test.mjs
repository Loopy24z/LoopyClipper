import {test} from 'node:test';import assert from 'node:assert/strict';
import {hookCandidates,startAtHook,openingHook} from '../lib/hooks.mjs';
const words=[];let t=0;for(const text of 'Halo teman teman. Kita membahas konten hari ini. Ternyata cara ini salah. Penjelasannya adalah konteks harus tetap utuh agar penonton memahami maksud sebenarnya. Kenapa hasilnya bisa berbeda? Mari kita lihat penjelasan yang lengkap.'.split(' ')){words.push({text,start:t,end:t+.36});t+=.42;}
const clip={start:0,end:t};
test('hooks quote original speech in 1-3 seconds and preserve the explanation',()=>{
 const hooks=hookCandidates(words,clip);assert.ok(hooks.length>=2);
 for(const h of hooks){assert.ok(h.duration>=1&&h.duration<=3);assert.equal(h.text,words.filter(w=>w.start>=h.start&&w.end<=h.end).map(w=>w.text).join(' '));assert.doesNotMatch(h.text,/^Halo/);const edited=startAtHook(clip,h);assert.equal(edited.start,h.start);assert.equal(edited.segments.at(-1).end,clip.end);}
});
test('hook candidates never use removed speech and applying preserves later cuts',()=>{
 const c={...clip,segments:[{start:0,end:3},{start:9,end:t}]};const hooks=hookCandidates(words,c);
 for(const h of hooks){assert.ok(h.start>=9||h.end<=3);const change=startAtHook(c,h);assert.ok(change.segments.every(s=>s.end<=3||s.start>=9));}
 assert.throws(()=>startAtHook(clip,{start:-1}));
});
test('signal detection never includes a word finishing beyond three seconds',()=>{
 const result=openingHook([{start:0,end:1,text:'Hello'},{start:2,end:4,text:'secret'}],0,5);assert.equal(result.text,'Hello');assert.equal(result.signal,'speech');
 assert.deepEqual(hookCandidates([{start:0,end:2,text:'Hello.'}],{start:0,end:10}),[]);
});

test('hooks include source continuation, reject dangling endings, and respect angle filters',()=>{
 for(const h of hookCandidates(words,clip)){
  assert.equal(h.context,words.filter(w=>w.start>=h.end-.081&&w.end<=h.contextEnd).map(w=>w.text).join(' '));
  assert.ok(h.contextEnd>h.end);assert.ok(h.contextEnd<=clip.end);
 }
 assert.ok(hookCandidates(words,clip,'question').every(h=>h.signal==='question'));
 assert.deepEqual(hookCandidates([{text:'Ternyata',start:0,end:.5},{text:'itu',start:.5,end:1},{text:'salah.',start:1,end:1.5}],{start:0,end:4}),[]);
});
