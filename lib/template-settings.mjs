import {validateClip} from './domain.mjs';
export const templateKeys=['motion','motionAmount','ratio','fit','position','captions','fontSize','font','textEffect','captionAnimation','color','background','wordsPerCaption','captionPosition','highlightColor','headlineEnabled','headlineDuration'];
export function templateSettings(value){
 const selected=Object.fromEntries(templateKeys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
 const validated=validateClip({...selected,title:'Template',description:'',start:0,end:10},10);
 return Object.fromEntries(templateKeys.map(key=>[key,validated[key]]));
}
