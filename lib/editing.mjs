/** Source-time segments are shared by draft playback and the export snapshot. */
export function segmentsFor(clip) {
 return clip.segments ?? [{start:clip.start,end:clip.end}];
}
export function editedDuration(clip) { return segmentsFor(clip).reduce((n,s)=>n+s.end-s.start,0); }
export function outputTime(clip,time) {
 let offset=0;
 for(const s of segmentsFor(clip)){if(time<s.end)return offset+Math.max(0,time-s.start);offset+=s.end-s.start;}
 return offset;
}
export function sourceTime(clip,time) {
 const segments=segmentsFor(clip);let remaining=Math.max(0,time);
 for(const s of segments){if(remaining<s.end-s.start)return s.start+remaining;remaining-=s.end-s.start;}
 return segments.at(-1).end;
}
export function pauseCuts(words,clip,mode) {
 const setting={natural:[.9,.2],balanced:[.65,.16],tight:[.45,.12]}[mode];
 if(!setting)return [{start:clip.start,end:clip.end}];
 const [threshold,padding]=setting;
 const relevant=words.filter(w=>w.start>=clip.start&&w.end<=clip.end);
 let start=clip.start;const segments=[];
 for(let i=1;i<relevant.length;i++){
  const before=relevant[i-1],after=relevant[i];
  const end=before.end+padding+(/[.!?]$/.test(before.text)?.15:0),next=after.start-padding;
  if(after.start-before.end>=threshold&&next-end>=.15&&end-start>=.8&&clip.end-next>=.8){segments.push({start,end});start=next;}
 }
 segments.push({start,end:clip.end});
 return segments.length<=200?segments:[{start:clip.start,end:clip.end}];
}
export const captionPresets=[
 {id:'clean',name:'Clean',textEffect:'bold',font:'lato',fontSize:48,wordsPerCaption:5},
 {id:'outline',name:'Bold outline',textEffect:'outline',font:'sans',fontSize:52,wordsPerCaption:4},
 {id:'box',name:'Background box',textEffect:'box',font:'sans',fontSize:44,wordsPerCaption:5},
 {id:'shadow',name:'Drop shadow',textEffect:'shadow',font:'serif',fontSize:48,wordsPerCaption:4},
 {id:'highlight',name:'Active word',textEffect:'highlight',font:'sans',fontSize:52,wordsPerCaption:4},
 {id:'single',name:'Single word',textEffect:'outline',font:'anton',fontSize:60,wordsPerCaption:1},
];
export function captionGroup(words,clip,time){
 const segment=segmentsFor(clip).find(s=>time>=s.start&&time<s.end);
 if(!segment)return [];
 const relevant=words.filter(w=>w.end>segment.start&&w.start<segment.end),count=Number.isInteger(clip.wordsPerCaption)&&clip.wordsPerCaption>=1&&clip.wordsPerCaption<=6?clip.wordsPerCaption:6;
 for(let i=0;i<relevant.length;i+=count){const group=relevant.slice(i,i+count);if(time>=Math.max(segment.start,group[0].start)&&time<Math.min(segment.end,group.at(-1).end))return group;}
 return [];
}
export function openingHook(words,start,end){
 const opening=words.filter(w=>w.start>=start&&w.start<Math.min(end,start+3)).map(w=>w.text).join(' ');
 const question=/\?|\b(why|how|kenapa|mengapa|bagaimana)\b/i.test(opening);
 const contrast=/\b(but|never|mistake|wrong|actually|ternyata|tapi|jangan|salah|bukan)\b/i.test(opening);
 const benefit=/\b(tips?|cara|rahasia|secret|kunci|penting|hasil|result)\b/i.test(opening);
 const greeting=/^(hi|hello|halo|hai|welcome|selamat|oke|okay)\b/i.test(opening);
 return {text:opening,score:(question?3:0)+(contrast?3:0)+(benefit?2:0)-(greeting?2:0),signal:question?'question':contrast?'contrast':benefit?'benefit':'speech'};
}
export function headlineFromWords(words,clip){
 const first=segmentsFor(clip)[0];
 const relevant=words.filter(w=>w.end>first.start&&w.start<first.end);
 let text='';
 for(const word of relevant.slice(0,10)){
  const next=(text+' '+word.text).trim();if(next.length>80)break;
  text=next;if(/[.!?]$/.test(word.text))break;
 }
 return text;
}
export function fundamentalSettings(words,clip){
 return {ratio:'9:16',fit:'cover',captions:true,font:'lato',fontSize:52,textEffect:'highlight',wordsPerCaption:4,captionPosition:'bottom',highlightColor:'#e5ff00',color:'#ffffff',background:'#000000',captionText:null,segments:pauseCuts(words,clip,'natural'),headline:headlineFromWords(words,clip),headlineEnabled:false,headlineDuration:3};
}
