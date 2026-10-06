// Deterministic editing assistant: preserves the user's words, never invents claims.
export function makeProductEdit(script, preset='punchy'){
 if(!['punchy','calm'].includes(preset))throw Error('Choose an edit preset.');
 const words=script.trim().split(/\s+/).filter(Boolean);
 if(!words.length)throw Error('Write your spoken script first.');
 if(words.length>120)throw Error('Use up to 120 words for a quick edit, or build scenes manually.');
 const size=Math.ceil(words.length/Math.min(8,Math.max(2,Math.ceil(words.length/15))));
 const scenes=[];
 for(let i=0;i<words.length;i+=size){const narration=words.slice(i,i+size).join(' ');if(narration.length>350)throw Error('Shorten long words or create scenes manually.');scenes.push({title:i===0?'Opening':'Scene '+(scenes.length+1),visual:'',narration,seconds:Math.max(2,Math.ceil(words.slice(i,i+size).length/2.5)),motion:scenes.length%2?'pull':'push',transition:preset==='punchy'?'cut':'fade',framing:scenes.length%2?'cover':'fit',intensity:preset==='punchy'?'dynamic':'gentle'});}
 return {scenes,captionStyle:preset==='punchy'?'highlight':'box',captionPosition:'bottom',captionSize:64,musicPreset:preset==='punchy'?'pulse':'calm'};
}
