export const publishPlatforms=['youtube','facebook','instagram'];
export function validatePublication(value,clip){
 if(!publishPlatforms.includes(value.platform))throw Error('Choose a supported publishing connection.');
 if(value.consent!==true)throw Error('Review the exported video and confirm the destination before sending.');
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>100||/[<>]/.test(value.title))throw Error('Use a title of 1-100 characters without angle brackets.');
 if(typeof value.description!=='string'||value.description.length>2000)throw Error('Keep the description under 2,000 characters.');
 if(value.platform==='youtube'&&!['private','unlisted','public'].includes(value.privacy))throw Error('Choose YouTube visibility.');
 if(value.platform!=='youtube'&&value.privacy!=='public')throw Error('Reels will be published publicly. Confirm this destination.');
 if(typeof value.madeForKids!=='boolean'||typeof value.synthetic!=='boolean')throw Error('Review audience and synthetic content settings.');
 if(clip.ratio!=='9:16'&&value.platform!=='youtube')throw Error('Export a 9:16 version for Instagram or Facebook Reels.');
 const duration=(clip.segments??[{start:clip.start,end:clip.end}]).reduce((n,s)=>n+s.end-s.start,0);
 if(value.platform==='facebook'&&(duration<3||duration>90))throw Error('This connector accepts Facebook Reels between 3 and 90 seconds. Trim and export again.');
 return {title:value.title.trim(),description:value.description,privacy:value.privacy,madeForKids:value.madeForKids,synthetic:value.synthetic};
}
export function publicationLink(platform,id){
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(id))return null;
 return platform==='youtube'?`https://www.youtube.com/watch?v=${id}`:platform==='facebook'?`https://www.facebook.com/reel/${id}`:null;
}
