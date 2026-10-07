import {validateUgcDraft} from './ugc-domain.mjs';
export function validateCreativePlan(value, facts){
 if(!value||typeof value!=='object'||!Array.isArray(value.scenes)||value.scenes.length<3||value.scenes.length>6)throw Error('The AI must return three to six scenes. Try again with a shorter brief.');
 const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('The AI returned incomplete or oversized copy. Please retry.');return v.trim()};
 const concept=text(value.concept,240),hook=text(value.hook,100),cta=text(value.cta,100);
 const scenes=value.scenes.map((s,i)=>{
 if(!s||!['hero','benefit','spotlight','cta'].includes(s.layout)||!['push','pull','still'].includes(s.motion)||!['fade','cut'].includes(s.transition))throw Error('The AI chose an unsupported scene effect. Please retry.');
 if(!Number.isInteger(s.seconds)||s.seconds<2||s.seconds>10)throw Error('The AI scene duration is invalid.');
 const evidence=s.evidence===undefined?'':text(s.evidence,300);
 if(facts!==undefined&&(!evidence||!facts.includes(evidence)))throw Error('The AI did not provide a matching product fact. Rewrite the brief with positive, verified facts and retry.');
 const seconds=Math.max(s.seconds,3,Math.ceil(s.narration.trim().split(/\s+/).length/2.5));
 if(seconds>10)throw Error('The AI narration is too long for one scene. Retry with a shorter brief.');
 return {evidence,title:['Opening','Benefit','Product detail','Closing'][Math.min(i,3)],visual:'',narration:text(s.narration,350),displayText:text(s.displayText,100),layout:s.layout,motion:s.motion,transition:s.transition,seconds,framing:'fit',intensity:'dynamic'};
 });
 if(scenes.reduce((n,s)=>n+s.seconds,0)>45||scenes[0].layout!=='hero'||scenes.at(-1).layout!=='cta')throw Error('The AI plan must open with a hero, end with a CTA and stay within 45 seconds.');
 if(!['violet','cyan','amber'].includes(value.palette))throw Error('The AI palette is unsupported.');
 const settings={scenes,palette:value.palette,captionStyle:'highlight',captionSize:64,captionPosition:'bottom',musicPreset:'pulse'};
 validateUgcDraft({title:'Plan',product:'',script:'',mode:'product',language:'id',style:'natural',ratio:'9:16',duration:15,rights:false,image:'',...settings});
 return {concept,hook,cta,...settings};
}
