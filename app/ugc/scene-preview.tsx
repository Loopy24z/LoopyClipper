"use client";
import {useEffect,useState} from 'react';
import type {Scene} from './storyboard';
type Props={image:string;ratio:string;script:string;duration:number;scenes?:Scene[];captionStyle?:string;captionPosition?:string};
export default function ScenePreview({data}:{data:Props}){
 const [time,setTime]=useState(0),[playing,setPlaying]=useState(false);
 const scenes=data.scenes?.length?data.scenes:[{title:'Product story',narration:data.script,seconds:data.duration,visual:''}];
 const total=scenes.reduce((n,s)=>n+s.seconds,0);
 useEffect(()=>{setTime(0);setPlaying(false)},[data]);
 useEffect(()=>{if(!playing)return;let previous=performance.now();const timer=setInterval(()=>{const now=performance.now(),delta=(now-previous)/1000;previous=now;setTime(t=>Math.min(total,t+delta))},40);return()=>clearInterval(timer)},[playing,total]);
 useEffect(()=>{if(time>=total)setPlaying(false)},[time,total]);
 let start=0,index=scenes.length-1;for(let i=0;i<scenes.length;i++){if(time<start+scenes[i].seconds||i===scenes.length-1){index=i;break}start+=scenes[i].seconds}
 const scene=scenes[index],local=Math.min(scene.seconds,time-start),fraction=local/scene.seconds;
 const motion=scene.motion||'auto',push=motion==='push'||motion==='auto'&&index%2===0;
 const zoom=motion==='still'?1:push?1+.035*fraction:1.035-.035*fraction;
 const opacity=scene.transition==='cut'?1:Math.max(0,Math.min(1,local/.15,(scene.seconds-local)/.15));
 const words=scene.narration.trim().split(/\s+/).filter(Boolean),word=Math.min(words.length-1,Math.floor(fraction*words.length)),group=Math.floor(Math.max(0,word)/5)*5;
 const effect=data.captionStyle||'outline',position=data.captionPosition||'bottom';
 return <div className="ugc-live-preview"><div className="ugc-live-stage"><div className="ugc-live-frame" style={{aspectRatio:data.ratio.replace(':','/')}}>{data.image?<><div className="ugc-live-picture" style={{transform:`scale(${zoom})`,opacity}}><img className="ugc-live-blur" src={data.image} alt=""/><img className="ugc-live-product" src={data.image} alt="Product composition preview"/></div>{effect!=='none'&&<div className={'ugc-live-caption '+effect+' '+position}>{words.slice(group,group+5).map((w,i)=><span key={group+i} style={{color:effect==='highlight'&&group+i===word?'#e5ff00':undefined}}>{w} </span>)}</div>}</>:<p>Add a reference image to preview your story.</p>}</div></div><div className="ugc-live-controls"><button type="button" disabled={!data.image} onClick={()=>{if(time>=total)setTime(0);setPlaying(!playing)}}>{playing?'Pause preview':'Play preview'}</button><span>{time.toFixed(1)} / {total}s</span><input type="range" aria-label="Preview playhead" min={0} max={total} step={.05} value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value))}}/></div><div className="ugc-live-scenes" aria-label="Preview scenes">{scenes.map((s,i)=><button type="button" key={i} aria-pressed={i===index} style={{flex:s.seconds}} onClick={()=>{setPlaying(false);setTime(scenes.slice(0,i).reduce((n,v)=>n+v.seconds,0)+.15)}}>{i+1}. {s.title||'Scene'}<small>{s.seconds}s</small></button>)}</div><p className="ugc-help">Silent composition preview · {scene.title}. Caption timing is estimated; font wrapping can differ in the exported MP4.</p></div>;
}
