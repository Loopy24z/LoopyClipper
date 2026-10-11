export const audioDefaults={speed:2.3,gain:-4,maxDuration:350};
export function audioSettings(v){
 if(!Number.isFinite(v.speed)||v.speed<.5||v.speed>4||!Number.isFinite(v.gain)||v.gain< -20||v.gain>20||!Number.isFinite(v.maxDuration)||v.maxDuration<10||v.maxDuration>1200)throw Error('Choose speed 0.5-4x, gain -20 to +20 dB and a source limit of 10-1200 seconds.');
 return {speed:v.speed,gain:v.gain,maxDuration:v.maxDuration};
}
export function audioOutputName(name){return (name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)||'converted')+'.ogg';}
export function outputSamples(length,speed){return Math.max(1,Math.round(length/speed));}
