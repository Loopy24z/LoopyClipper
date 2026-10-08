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
 if(!['sans','serif','mono','lato','anton'].includes(v.font??'sans')||!['box','outline','shadow','bold','highlight'].includes(v.textEffect??'box'))throw Error('Choose a supported caption font and effect.');
 const captionAnimation=v.captionAnimation??'none';
 if(!['none','pop','rise','reveal'].includes(captionAnimation))throw Error('Choose a supported caption animation.');
 const wordsPerCaption=v.wordsPerCaption??6,captionPosition=v.captionPosition??'bottom',highlightColor=v.highlightColor??'#e5ff00';
 if(!Number.isInteger(wordsPerCaption)||wordsPerCaption<1||wordsPerCaption>6||!['top','center','bottom'].includes(captionPosition)||!/^#[0-9a-f]{6}$/i.test(highlightColor))throw Error('Invalid caption layout.');
 const headline=v.headline??'',headlineEnabled=v.headlineEnabled??false,headlineDuration=v.headlineDuration??3;
 if(typeof headline!=='string'||headline.length>80||typeof headlineEnabled!=='boolean'||!Number.isFinite(headlineDuration)||headlineDuration<1||headlineDuration>10)throw Error('Headline must be at most 80 characters and appear for 1–10 seconds.');
 let segments;
 if(v.segments!=null){
  if(!Array.isArray(v.segments)||!v.segments.length||v.segments.length>200)throw Error('Choose between 1 and 200 segments.');
  let previous=v.start;
  segments=v.segments.map(s=>{if(!s||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<previous||s.start<v.start||s.end>v.end||s.end-s.start<.1)throw Error('Segments must be ordered, non-overlapping and inside the trim range.');previous=s.end;return {start:s.start,end:s.end};});
 }
 return {captionAnimation,headline,headlineEnabled,headlineDuration,segments,wordsPerCaption,captionPosition,highlightColor,font:v.font??'sans',textEffect:v.textEffect??'box',reason:typeof v.reason==='string'?v.reason.slice(0,600):undefined,title:v.title.trim(),description:v.description,start:v.start,end:v.end,ratio:v.ratio,fit:v.fit,position:v.position,captions:v.captions,fontSize:v.fontSize,color:v.color,background:v.background,captionText:v.captionText??null};
}
export {suggestHighlights} from './highlights.mjs';
