import {openingHook,fundamentalSettings} from './editing.mjs';
const stop=/[.!?]["'”’)]*$/;
const dependent=/^(dan|tapi|jadi|karena|sehingga|lalu|itu|tersebut|and|but|so|because|therefore|this|that|it)\b/i;
const closure=/\b(intinya|kesimpulannya|itulah|akhirnya|hasilnya|ingat|artinya|finally|remember|result|in short)\b/i;
export function suggestHighlights(words,duration,language='en'){
 if(!words.length||duration<15)return [];
 // Sentence/pause boundaries, with bounded fallback for transcripts without punctuation.
 const units=[];let first=0;
 for(let i=0;i<words.length;i++){
  const next=words[i+1],pause=next?next.start-words[i].end:0;
  if(!next||stop.test(words[i].text)||pause>=.9||words[i].end-words[first].start>=22){
   units.push({first,last:i,complete:stop.test(words[i].text)||!next||pause>=.9,gap:pause});first=i+1;
  }
 }
 const candidates=[];
 for(let a=0;a<units.length;a++){
  // Expand dependent openings back one sentence instead of orphaning an explanation.
  if(a>0&&dependent.test(words[units[a].first].text))continue;
  const start=Math.max(0,words[units[a].first].start-.18);let best=null;
  for(let b=a;b<units.length;b++){
   if(b>a&&units[b-1].gap>2.5)break; // Do not bridge disconnected passages.
   const end=Math.min(duration,words[units[b].last].end+.24),length=end-start;
   if(length>90)break;if(length<15)continue;
   const segment=words.slice(units[a].first,units[b].last+1);if(segment.length<8)continue;
   const text=segment.map(w=>w.text).join(' '),opening=openingHook(segment,start,end);
   const lastText=words.slice(units[b].first,units[b].last+1).map(w=>w.text).join(' ');
   const answered=!/\?$/.test(words[units[b].last].text);
   // Prefer a complete conclusion, not an arbitrary fixed-length window.
   const score=opening.score*1.4+(units[b].complete?3:-4)+(answered?1:-5)+(closure.test(lastText)?2:0)
    -Math.abs(length-38)/28-(dependent.test(words[units[a].first].text)?3:0)
    -(b===a&&opening.signal==='question'?2:0);
   if(!best||score>best.score)best={start,end,text,score,complete:units[b].complete,signal:opening.signal};
  }
  if(best)candidates.push(best);
 }
 const selected=[];
 for(const candidate of candidates.sort((a,b)=>b.score-a.score||a.start-b.start)){
  if(!selected.some(s=>candidate.start<s.end&&candidate.end>s.start))selected.push(candidate);
  if(selected.length===5)break;
 }
 return selected.sort((a,b)=>a.start-b.start).map(({text,score,complete,signal,...clip})=>{
  const hook=language==='id'?{surprise:'Pembuka kejutan atau kontras.',curiosity:'Pembuka rasa ingin tahu.',question:'Pembuka pertanyaan.',contrast:'Pembuka kontras atau peringatan.',benefit:'Pembuka manfaat atau tips.',speech:'Pembuka percakapan.'}:{surprise:'Surprising contrast opening.',curiosity:'Curiosity opening.',question:'Question opening.',contrast:'Contrast or warning opening.',benefit:'Benefit or advice opening.',speech:'Conversation opening.'};
  const reason=hook[signal]+' '+(language==='id'?(complete?'Akhir mengikuti kalimat atau jeda alami.':'Transkrip minim tanda baca; batas kata perlu ditinjau.')+' Durasi mengikuti konteks kalimat, bukan selalu 30 detik. Saran berbasis aturan transkrip; tinjau makna sebelum ekspor.':(complete?'Ends at a sentence or natural pause.':'Limited punctuation; review the word boundary.')+' Length follows sentence context, not a fixed 30 seconds. Transcript-rule draft; review meaning before export.');
  return {...clip,title:text.split(/\s+/).slice(0,8).join(' ').slice(0,100),description:text.slice(0,350),reason,...fundamentalSettings(words,clip)};
 });
}
