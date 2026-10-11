export const audioDefaults={speed:2.3,gain:-4,maxDuration:350,format:"ogg",bitrate:128};
export function audioSettings(v){
 if(!Number.isFinite(v.speed)||v.speed<.5||v.speed>4||!Number.isFinite(v.gain)||v.gain< -20||v.gain>20||!Number.isFinite(v.maxDuration)||v.maxDuration<10||v.maxDuration>1200)throw Error('Choose speed 0.5-4x, gain -20 to +20 dB and a source limit of 10-1200 seconds.');
 const format=v.format??"ogg",bitrate=v.bitrate??128;
 if(!["mp3","ogg","wav"].includes(format)||![64,96,128,160,192,256,320].includes(bitrate))throw Error("Choose a supported format and bitrate.");
 return {format,bitrate,speed:v.speed,gain:v.gain,maxDuration:v.maxDuration};
}
export function audioOutputName(name,format="ogg"){return (name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)||'converted')+'.'+(['mp3','ogg','wav'].includes(format)?format:'ogg');}
export function outputSamples(length,speed){return Math.max(1,Math.round(length/speed));}
