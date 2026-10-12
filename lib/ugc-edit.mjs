// Editing recipes use only the supplied script; no product claims are generated.
export const productEditPresets=[
 {id:'showcase',name:'Product showcase',detail:'Hero opening, benefit cards, product close-up and a clean closing frame.'},
 {id:'punchy',name:'Social punch',detail:'Short opening, bold copy, quick cuts and energetic music.'},
 {id:'calm',name:'Editorial calm',detail:'Longer holds, understated captions and soft transitions.'}
];
export function makeProductEdit(script,preset='showcase'){
 if(!productEditPresets.some(p=>p.id===preset))throw Error('Choose an edit preset.');
 const words=script.trim().split(/\s+/).filter(Boolean);
 if(!words.length)throw Error('Write your spoken script first.');
 if(words.length>120)throw Error('Use up to 120 words for a quick edit, or build scenes manually.');
 const groups=[];let cursor=0;
 while(cursor<words.length){
  const remaining=words.length-cursor,slots=8-groups.length;
  let take;
  if(slots===1)take=remaining;
  else if(cursor===0){take=Math.min(remaining,preset==='calm'?10:7);for(let n=2;n<=take;n++){if(/[.!?;]$/.test(words[n-1])){take=n;break;}}}
  else{
   const target=Math.max(Math.ceil(remaining/slots),preset==='calm'?20:16);
   take=Math.min(remaining,target);
   // Prefer the end of a phrase rather than cutting mechanically every N words.
   for(let n=Math.max(2,Math.ceil(remaining/slots));n<=Math.min(remaining,target+3,30);n++){
    if(/[.!?;,]$/.test(words[cursor+n-1])){take=n;break;}
   }
  }
  groups.push(words.slice(cursor,cursor+take));cursor+=take;
 }
 const scenes=groups.map((group,i)=>{
  const last=i===groups.length-1,layout=i===0?'hero':last?'cta':i%2?'benefit':'spotlight';
  const narration=group.join(' ');if(narration.length>350)throw Error('Shorten long words or create scenes manually.');
  let headingLength=Math.min(group.length,7);for(let n=2;n<=headingLength;n++){if(/[.!?;]$/.test(group[n-1])){headingLength=n;break;}}
  const headline=group.slice(0,headingLength).join(' ');
  return {title:i===0?'Opening':last?'Closing':layout==='benefit'?'Key message':'Product detail',visual:'',narration,
   displayText:headline.length<=100?headline:headline.slice(0,97)+'...',layout,
   seconds:Math.max(2,Math.ceil(group.length/(preset==='calm'?2.3:2.5))),
   motion:last?'still':i%2?'pull':'push',transition:preset==='punchy'?'cut':'fade',
   framing:'fit',intensity:preset==='punchy'?'dynamic':'gentle'};
 });
 if(scenes.reduce((n,s)=>n+s.seconds,0)>60)throw Error('Shorten the script to fit within 60 seconds.');
 return {scenes,captionStyle:preset==='punchy'?'highlight':'outline',captionPosition:'bottom',captionSize:preset==='punchy'?64:44,musicPreset:preset==='punchy'?'pulse':'calm'};
}
