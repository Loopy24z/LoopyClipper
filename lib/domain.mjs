export const PART_SIZE=8*1024*1024;
export function validateUpload(v){
 if(!v||typeof v.name!=='string'||v.name.length>200||!/\.(mp4|mov)$/i.test(v.name))throw Error('Choose an MP4 or MOV video.');
 if(!Number.isInteger(v.size)||v.size<1||v.size>2*1024**3)throw Error('Videos must be no larger than 2 GB.');
 if(!Number.isFinite(v.duration)||v.duration<=0||v.duration>3600)throw Error('Videos must be between 0 and 60 minutes long.');
 if(v.rights!==true)throw Error('Confirm that you have permission to process this video.');
 if(!['auto','en','id'].includes(v.language))throw Error('Choose English, Indonesian, or automatic detection.');
 if(v.youtube){let u;try{u=new URL(v.youtube)}catch{throw Error('Enter a valid YouTube URL.')}if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','youtu.be','m.youtube.com'].includes(u.hostname)||u.username||u.password)throw Error('Use an HTTPS YouTube URL.');}
 return {name:v.name,size:v.size,duration:v.duration,language:v.language,youtube:v.youtube||''};
}
export function validateClip(v,duration){
 if(!v||typeof v.title!=='string'||!v.title.trim()||v.title.length>150||typeof v.description!=='string'||v.description.length>2000)throw Error('Add a title (up to 150 characters) and description (up to 2,000).');
 if(!Number.isFinite(v.start)||!Number.isFinite(v.end)||v.start<0||v.end>duration||v.end-v.start<.1)throw Error('Clip boundaries must be inside the video, with the end after the start.');
 if(!['9:16','1:1','16:9'].includes(v.ratio)||!['contain','cover'].includes(v.fit))throw Error('Choose a supported frame.');
 if(!Number.isFinite(v.position)||v.position<0||v.position>100||!Number.isFinite(v.fontSize)||v.fontSize<16||v.fontSize>72)throw Error('Invalid crop position or caption size.');
 if(typeof v.captions!=='boolean'||![v.color,v.background].every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))throw Error('Invalid caption settings.');
 if(v.captionText!=null&&(typeof v.captionText!=='string'||v.captionText.length>5000))throw Error('Caption override is too long.');
 if(!['sans','serif','mono'].includes(v.font??'sans')||!['box','outline','shadow','bold'].includes(v.textEffect??'box'))throw Error('Choose a supported caption font and effect.');
 return {font:v.font??'sans',textEffect:v.textEffect??'box',reason:typeof v.reason==='string'?v.reason.slice(0,600):undefined,title:v.title.trim(),description:v.description,start:v.start,end:v.end,ratio:v.ratio,fit:v.fit,position:v.position,captions:v.captions,fontSize:v.fontSize,color:v.color,background:v.background,captionText:v.captionText??null};
}
export function suggestHighlights(words,duration,language='en'){
 // Transcript-based draft suggestions, not a semantic or virality score.
 if(!words.length||duration<15)return [];
 const candidates=[];
 for(let start=words[0].start;start+15<=duration;start+=30){
  const end=Math.min(start+30,duration),segment=words.filter(w=>w.start>=start&&w.start<end);
  if(segment.length<8)continue;
  const text=segment.map(w=>w.text).join(' '),question=/[?]|\b(why|how|kenapa|mengapa|bagaimana)\b/i.test(text),advice=/\b(tip|tips|cara|langkah|try|start|first|penting)\b/i.test(text);
  const hook=question?(language==='id'?'Memuat pertanyaan yang bisa menjadi pembuka diskusi.':'Includes a question that can open a discussion.'):advice?(language==='id'?'Memuat petunjuk atau langkah yang dapat dijadikan tips singkat.':'Includes practical steps or advice for a short tip.'):language==='id'?'Bagian percakapan dengan ujaran berurutan.':'A passage with continuous speech.';
  const reason=hook+' '+(language==='id'?`${Math.round(end-start)} detik, ${segment.length} kata. Tinjau konteks dan batas kalimat sebelum ekspor.`:`${Math.round(end-start)} seconds, ${segment.length} words. Review context and sentence boundaries before export.`);
  candidates.push({start,end,title:text.split(/\s+/).slice(0,8).join(' ').slice(0,100),description:text.slice(0,350),reason,score:(question?2:0)+(advice?1:0)});
 }
 return candidates.sort((a,b)=>b.score-a.score).slice(0,5).sort((a,b)=>a.start-b.start).map(({score,...clip})=>clip);
}
