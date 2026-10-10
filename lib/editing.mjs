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
 const setting={natural:[1.15,.24],balanced:[.8,.2],tight:[.55,.16]}[mode];
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
 {id:'cyan',name:'Neon cyan',textEffect:'highlight',font:'lato',fontSize:54,wordsPerCaption:3,highlightColor:'#45e5ff'},
 {id:'gold',name:'Golden hour',textEffect:'outline',font:'anton',fontSize:56,wordsPerCaption:3,color:'#ffd166'},
 {id:'editorial',name:'Editorial',textEffect:'shadow',font:'serif',fontSize:48,wordsPerCaption:5,color:'#fff3df'},
 {id:'rose',name:'Rose box',textEffect:'box',font:'lato',fontSize:48,wordsPerCaption:3,background:'#722c4d'},
 {id:'podcast',name:'Podcast',textEffect:'box',font:'mono',fontSize:42,wordsPerCaption:5,color:'#a9f5cd',background:'#16332b'},
 {id:'center',name:'Center stage',textEffect:'highlight',font:'anton',fontSize:64,wordsPerCaption:2,highlightColor:'#ff927a',captionPosition:'center'},
 {id:'pop',name:'Pulse Pop',captionAnimation:'pop',textEffect:'highlight',font:'anton',fontSize:58,wordsPerCaption:3,highlightColor:'#c4a7ff'},
 {id:'rise',name:'Soft Rise',captionAnimation:'rise',textEffect:'shadow',font:'lato',fontSize:52,wordsPerCaption:4},
 {id:'reveal',name:'Word Reveal',captionAnimation:'reveal',textEffect:'highlight',font:'lato',fontSize:54,wordsPerCaption:3,highlightColor:'#45e5ff'},
].map(preset=>({captionAnimation:'none',color:'#ffffff',background:'#000000',highlightColor:'#e5ff00',captionPosition:'bottom',...preset}));
export function captionGroups(words,clip){
 const groups=[],count=Number.isInteger(clip.wordsPerCaption)&&clip.wordsPerCaption>=1&&clip.wordsPerCaption<=6?clip.wordsPerCaption:6;
 for(const segment of segmentsFor(clip)){
  const relevant=words.filter(w=>w.end>segment.start&&w.start<segment.end);let group=[];
  for(const word of relevant){
   if(group.length&&(group.length>=count||/[.!?,;:]$/.test(group.at(-1).text)||word.start-group.at(-1).end>=.45)){groups.push(group);group=[];}
   group.push({...word,start:Math.max(segment.start,word.start),end:Math.min(segment.end,word.end)});
  }
  if(group.length)groups.push(group);
 }
 return groups;
}
export function captionGroup(words,clip,time){return captionGroups(words,clip).find(g=>time>=g[0].start&&time<g.at(-1).end)||[];}
export function captionMotion(animation,elapsed){
 const progress=Math.max(0,Math.min(1,elapsed/.18));
 return {opacity:animation==='rise'?progress:1,scale:animation==='pop'?.88+.12*progress:1,rise:animation==='rise'?.45*(1-progress):0};
}
export {openingHook} from './hooks.mjs';
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
