"use client";
import {useEffect,useRef,useState} from 'react';
import layouts from '@/lib/ugc-layouts.json';
import type {Scene} from './storyboard';
type Props={image:string;ratio:string;script:string;duration:number;scenes?:Scene[];captionStyle?:string;captionPosition?:string;captionSize?:number;musicPreset?:string;palette?:string};
export default function ScenePreview({data}:{data:Props}){
 const music=useRef<HTMLAudioElement>(null);
 const [time,setTime]=useState(0),[playing,setPlaying]=useState(false);
 const track=data.musicPreset&&data.musicPreset!=='none'?`/audio/${data.musicPreset}.wav`:undefined;
 useEffect(()=>{if(!music.current)return;music.current.volume=.55;if(playing){void music.current.play().catch(()=>setPlaying(false))}else music.current.pause()},[playing,track]);
 useEffect(()=>{const player=music.current;if(player&&Number.isFinite(player.duration)&&player.duration>0){const wanted=time%player.duration;if(Math.abs(player.currentTime-wanted)>.25)player.currentTime=wanted}},[time]);
 const scenes=data.scenes?.length?data.scenes:[{title:'Product story',narration:data.script,seconds:data.duration,visual:''}];
 const total=scenes.reduce((n,s)=>n+s.seconds,0);
 useEffect(()=>{setTime(0);setPlaying(false)},[data]);
 useEffect(()=>{if(!playing)return;let previous=performance.now();const timer=setInterval(()=>{const now=performance.now(),delta=(now-previous)/1000;previous=now;setTime(t=>Math.min(total,t+delta))},40);return()=>clearInterval(timer)},[playing,total]);
 useEffect(()=>{if(time>=total)setPlaying(false)},[time,total]);
 let start=0,index=scenes.length-1;for(let i=0;i<scenes.length;i++){if(time<start+scenes[i].seconds||i===scenes.length-1){index=i;break}start+=scenes[i].seconds}
 const scene:Scene=scenes[index],local=Math.min(scene.seconds,time-start),fraction=local/scene.seconds;
 const motion=scene.motion||'auto',push=motion==='push'||motion==='auto'&&index%2===0;
 const strength=scene.intensity==='dynamic'?.12:.035;
 const zoom=motion==='still'?1:push?1+strength*fraction:1+strength-strength*fraction;
 const opacity=scene.transition==='cut'?1:Math.max(0,Math.min(1,local/.15,(scene.seconds-local)/.15));
 const words=scene.narration.trim().split(/\s+/).filter(Boolean),word=Math.min(words.length-1,Math.floor(fraction*words.length)),group=Math.floor(Math.max(0,word)/5)*5;
 const layout=layouts[(scene.layout||'full') as keyof typeof layouts];
 const colors=({violet:['#151126','#a78bfa'],cyan:['#071d28','#22d3ee'],amber:['#251a0b','#fbbf24']} as Record<string,string[]>)[data.palette||'violet'];
 const effect=data.captionStyle||'outline',position=data.captionPosition||'bottom';
 return <div className="ugc-live-preview">{track&&<audio ref={music} src={track} loop preload="metadata"/>}<div className="ugc-live-stage"><div className="ugc-live-frame" style={{aspectRatio:data.ratio.replace(':','/'),background:layout?colors[0]:'#000'}}>{data.image?<>{layout&&<><div style={{position:'absolute',top:'4%',left:'8%',width:'18%',height:4,background:colors[1]}}/><div style={{position:'absolute',top:`${layout.text[1]*100}%`,left:'8%',right:'8%',fontSize:`${layout.size*(data.ratio==='16:9'?9/16:1)*100}cqw`,textAlign:'center',color:'white',fontFamily:'Arial',fontWeight:700,lineHeight:1.15}}>{scene.displayText}</div></>}<div className="ugc-live-picture" style={layout?{left:`${layout.image[0]*100}%`,top:`${layout.image[1]*100}%`,width:`${layout.image[2]*100}%`,height:`${layout.image[3]*100}%`,overflow:'hidden',border:`1px solid ${colors[1]}`,opacity}:{transform:`scale(${zoom})`,opacity}}>{!layout&&<img className="ugc-live-blur" src={data.image} alt=""/>}<img className="ugc-live-product" style={{objectFit:!layout&&scene.framing==='cover'?'cover':'contain',transform:layout?`scale(${zoom})`:undefined}} src={data.image} alt="Product composition preview"/></div>{effect!=='none'&&<div className={'ugc-live-caption '+effect+' '+position} style={{fontSize:`${(data.captionSize||44)/(data.ratio==='16:9'?1920:1080)*100}cqw`}}>{words.slice(group,group+5).map((w,i)=><span key={group+i} style={{color:effect==='highlight'&&group+i===word?'#e5ff00':undefined}}>{w} </span>)}</div>}</>:<p>Add a reference image to preview your story.</p>}</div></div><div className="ugc-live-controls"><button type="button" disabled={!data.image} onClick={()=>{if(time>=total)setTime(0);setPlaying(!playing)}}>{playing?'Pause preview':'Play preview'}</button><span>{time.toFixed(1)} / {total}s</span><input type="range" aria-label="Preview playhead" min={0} max={total} step={.05} value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value))}}/></div><div className="ugc-live-scenes" aria-label="Preview scenes">{scenes.map((s,i)=><button type="button" key={i} aria-pressed={i===index} style={{flex:s.seconds}} onClick={()=>{setPlaying(false);setTime(scenes.slice(0,i).reduce((n,v)=>n+v.seconds,0)+.15)}}>{i+1}. {s.title||'Scene'}<small>{s.seconds}s</small></button>)}</div><p className="ugc-help">{track?'Composition preview with built-in music':'Silent composition preview'} · {scene.title}. Caption timing is estimated; font wrapping can differ in the exported MP4.</p></div>;
}
