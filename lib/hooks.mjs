/** @type {Array<[string, RegExp, number]>} */
const signals=[
 ['question',/\?|\b(why|how|kenapa|mengapa|bagaimana|kok|gimana|what if|bagaimana kalau)\b/i,4],
 ['surprise',/\b(ternyata|rupanya|padahal|justru|sebenarnya|actually|turns out|surpris\w*)\b/i,4],
 ['contrast',/\b(jangan|salah|kesalahan|gagal|bukan|never|mistake|wrong|fail\w*)\b/i,3],
 ['curiosity',/\b(rahasia|jarang|belum tahu|nggak tahu|tidak tahu|secret|nobody|didn't know)\b/i,4],
 ['benefit',/\b(cara|tips?|kunci|penting|hasil|result|hemat|save|solusi|solution)\b/i,2],
];
export function openingHook(words,start,end){
 const selected=words.filter(w=>w.start>=start&&w.end<=Math.min(end,start+3));
 const text=selected.map(w=>w.text).join(' '),matches=signals.filter(([,pattern])=>pattern.test(text));
 const greeting=/^(hi|hello|halo|hai|welcome|selamat|oke|okay)\b/i.test(text);
 const score=Math.min(8,matches.reduce((n,[,,weight])=>n+weight,0))-(greeting?4:0);
 return {text,score,signal:matches[0]?.[0]||'speech'};
}
const labels={question:'A question invites an answer.',surprise:'A surprising contrast invites an explanation.',contrast:'A mistake or warning creates a reason to keep watching.',curiosity:'An information gap invites the next sentence.',benefit:'A concrete benefit gives the viewer a reason to stay.',speech:'Original speech opening.'};
export function hookCandidates(words,clip){
 const segments=clip.segments??[{start:clip.start,end:clip.end}],out=[];
 for(const segment of segments){
  const relevant=words.filter(w=>w.start>=segment.start&&w.end<=segment.end);
  for(let i=0;i<relevant.length;i++){
   const word=relevant[i],prev=relevant[i-1];
   if(i&& !/[.!?]["')]*$/.test(prev.text)&&word.start-prev.end<.6)continue;
   // Do not turn a dependent clause into a standalone opening.
   if(/^(karena|sehingga|tersebut|because|therefore|which)\b/i.test(word.text))continue;
   const start=Math.max(segment.start,word.start-.12),limit=Math.min(segment.end,start+3);
   const excerpt=[];
   for(const next of relevant.slice(i)){
    if(next.end>limit)break;
    if(excerpt.length&&next.start-excerpt.at(-1).end>.6)break;
    excerpt.push(next);if(/[.!?]["')]*$/.test(next.text))break;
   }
   if(excerpt.length<3)continue;
   const end=Math.min(limit,excerpt.at(-1).end+.08),duration=end-start;
   if(duration<1||segment.end-start<3)continue;
   const hook=openingHook(excerpt,start,end);
   if(hook.score<2)continue;
   out.push({start,end,duration,text:hook.text,score:hook.score,signal:hook.signal,reason:labels[hook.signal]});
  }
 }
 const chosen=[];
 for(const candidate of out.sort((a,b)=>b.score-a.score||a.start-b.start)){
  if(!chosen.some(h=>candidate.start<h.end&&candidate.end>h.start))chosen.push(candidate);
  if(chosen.length===3)break;
 }
 return chosen;
}
export function startAtHook(clip,hook){
 const segments=(clip.segments??[{start:clip.start,end:clip.end}]).filter(s=>s.end>hook.start).map(s=>({...s,start:Math.max(s.start,hook.start)}));
 if(!segments.length||segments[0].end-segments[0].start<.1||hook.start<clip.start||hook.start>=clip.end)throw Error('Choose a hook inside this clip.');
 return {start:segments[0].start,segments};
}
