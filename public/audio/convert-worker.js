/* Conversion DSP adapted from Loopy24z/sound-convert. See SOURCE.txt for encoder sources. */
var module={exports:{}};var exports=module.exports;
self.onmessage=function(event){
 let enc=null,lib=null;
 try{
  const {channels,sampleRate,speed,gain,format='ogg',bitrate=128}=event.data;
  if(!Array.isArray(channels)||!channels.length||channels.length>2||!channels[0].length||channels.some(c=>c.length!==channels[0].length)||![44100,48000].includes(sampleRate)||!Number.isFinite(speed)||speed<.5||speed>4||!Number.isFinite(gain)||gain< -20||gain>20||!['ogg','mp3','wav'].includes(format)||![64,96,128,160,192,256,320].includes(bitrate))throw Error('Invalid audio settings.');
  const total=Math.max(1,Math.round(channels[0].length/speed)),amplitude=Math.pow(10,gain/20),parts=[];
  let mp3,wav,view;
  if(format==='ogg'){importScripts('/audio/libvorbis.js');lib=module.exports;const quality={64:-.1,96:.1,128:.4,160:.5,192:.6,256:.8,320:.9}[bitrate];enc=lib._encoder_init(channels.length,sampleRate,quality);if(!enc)throw Error('Encoder initialization failed.');lib._encoder_stream_init(enc);}
  if(format==='mp3'){importScripts('/audio/lame.min.js');mp3=new lamejs.Mp3Encoder(channels.length,sampleRate,bitrate);}
  if(format==='wav'){
   wav=new ArrayBuffer(44+total*channels.length*2);view=new DataView(wav);
   const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i))};
   text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels.length,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels.length*2,true);view.setUint16(32,channels.length*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,wav.byteLength-44,true);
  }
  function process(count){lib._encoder_process(enc,count);const n=lib._encoder_data_len(enc);if(n){const p=lib._encoder_transfer_data(enc);parts.push(lib.HEAPU8.slice(p,p+n));}}
  let clipped=0;
  for(let offset=0;offset<total;offset+=4096){
   const count=Math.min(4096,total-offset),ptr=lib?(lib._encoder_analysis_buffer(enc,count)>>2):0,pcm=[];
   for(let c=0;c<channels.length;c++){
    const input=channels[c],target=lib?lib.HEAPU32[ptr+c]>>2:0,out=new Int16Array(count);
    for(let i=0;i<count;i++){
     const source=(offset+i)*speed,low=Math.min(Math.floor(source),input.length-1),high=Math.min(low+1,input.length-1),mix=source-Math.floor(source);
     let value=(input[low]*(1-mix)+input[high]*mix)*amplitude;if(Math.abs(value)>1)clipped++;value=Math.max(-1,Math.min(1,value));
     if(lib)lib.HEAPF32[target+i]=value;else{out[i]=Math.round(value*(value<0?32768:32767));if(view)view.setInt16(44+((offset+i)*channels.length+c)*2,out[i],true);}
    }pcm.push(out);
   }
   if(lib)process(count);if(mp3){const bytes=mp3.encodeBuffer(pcm[0],pcm[1]);if(bytes.length)parts.push(new Uint8Array(bytes));}
   if(offset%32768===0)self.postMessage({progress:Math.round((offset+count)/total*100)});
  }
  if(lib)process(0);if(mp3){const tail=mp3.flush();if(tail.length)parts.push(new Uint8Array(tail));}if(wav)parts.push(wav);
  self.postMessage({blob:new Blob(parts,{type:{ogg:'audio/ogg',mp3:'audio/mpeg',wav:'audio/wav'}[format]}),clipped,duration:total/sampleRate});
 }catch(error){self.postMessage({error:'Audio encoding failed. Try a shorter duration or a smaller file.'});}
 finally{if(enc)lib._encoder_clear(enc);}
};
