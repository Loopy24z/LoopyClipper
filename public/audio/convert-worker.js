/* DSP adapted from Loopy24z/sound-convert; encoding is isolated off the UI thread. */
var module={exports:{}};var exports=module.exports;
importScripts('/audio/libvorbis.js');
self.onmessage=function(event){
 let enc=null;const lib=module.exports;
 try{
  const {channels,sampleRate,speed,gain}=event.data;
  if(!Array.isArray(channels)||!channels.length||channels.length>2||!Number.isFinite(speed)||speed<.5||speed>4||!Number.isFinite(gain)||gain< -20||gain>20)throw Error('Invalid audio settings.');
  const total=Math.max(1,Math.round(channels[0].length/speed)),amplitude=Math.pow(10,gain/20),parts=[];
  enc=lib._encoder_init(channels.length,sampleRate,.4);if(!enc)throw Error('Encoder could not initialize.');lib._encoder_stream_init(enc);
  function process(count){lib._encoder_process(enc,count);const n=lib._encoder_data_len(enc);if(n){const p=lib._encoder_transfer_data(enc);parts.push(lib.HEAPU8.slice(p,p+n));}}
  let clipped=0;
  for(let offset=0;offset<total;offset+=4096){
   const count=Math.min(4096,total-offset),ptr=lib._encoder_analysis_buffer(enc,count)>>2;
   for(let c=0;c<channels.length;c++){
    const input=channels[c],target=lib.HEAPU32[ptr+c]>>2;
    for(let i=0;i<count;i++){
     const source=(offset+i)*speed,low=Math.min(Math.floor(source),input.length-1),high=Math.min(low+1,input.length-1),mix=source-Math.floor(source);
     const value=(input[low]*(1-mix)+input[high]*mix)*amplitude;
     if(Math.abs(value)>1)clipped++;
     lib.HEAPF32[target+i]=Math.max(-1,Math.min(1,value));
    }
   }
   process(count);
   if(offset%32768===0)self.postMessage({progress:Math.round((offset+count)/total*100)});
  }
  process(0);self.postMessage({blob:new Blob(parts,{type:'audio/ogg'}),clipped,duration:total/sampleRate});
 }catch(error){self.postMessage({error:'Audio encoding failed. Try a shorter duration or a smaller file.'});}
 finally{if(enc)lib._encoder_clear(enc);}
};
