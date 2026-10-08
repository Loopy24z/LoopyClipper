"use client";
import type {ClipData} from '@/lib/types';
import {captionMotion,outputTime} from '@/lib/editing.mjs';
export function CaptionOverlay({data,group,time,caption}:{data:ClipData;group:{start:number;end:number;text:string}[];time:number;caption:string}){
 const animation=data.captionAnimation||'none',effect=data.textEffect||'box';
 const elapsed=data.captionText?outputTime(data,time):time-(group[0]?.start??time);
 const motion=captionMotion(animation,elapsed);
 const outline=['outline','highlight'].includes(effect);
 return <div className="caption-preview" style={{width:'87%',padding:0,top:data.captionPosition==='top'?(data.headlineEnabled&&data.headline?'32%':'8%'):data.captionPosition==='center'?'50%':undefined,bottom:data.captionPosition==='top'||data.captionPosition==='center'?'auto':'8%',transform:data.captionPosition==='center'?'translate(-50%, -50%)':'translateX(-50%)',color:data.color,fontFamily:data.font==='lato'?'Loofy Lato, sans-serif':data.font==='anton'?'Loofy Anton, sans-serif':data.font==='serif'?'Times New Roman, serif':data.font==='mono'?'Courier New, monospace':'Arial, sans-serif',fontWeight:['bold','outline','highlight'].includes(effect)?700:400,WebkitTextStroke:outline?`0.035em ${data.background}`:undefined,paintOrder:'stroke fill',textShadow:effect==='shadow'?`0.035em 0.035em 0 ${data.background}`:undefined,fontSize:`${data.fontSize/(data.ratio==='16:9'?1920:1080)*100}cqw`}}><span style={{display:'inline-block',backgroundColor:effect==='box'?data.background:'transparent',opacity:motion.opacity,transform:`translateY(${motion.rise}em) scale(${motion.scale})`}}>{!data.captionText?group.map((w,i)=><span key={i} style={{visibility:animation==='reveal'&&time<w.start?'hidden':undefined,color:effect==='highlight'&&time>=w.start&&time<w.end?(data.highlightColor||'#e5ff00'):data.color}}>{w.text}{i<group.length-1?' ':''}</span>):caption}</span></div>;
}
