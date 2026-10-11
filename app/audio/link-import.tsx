"use client";
import {useEffect,useRef,useState} from 'react';
import {Link2,Download,LoaderCircle,X} from 'lucide-react';
import {api} from '@/lib/types';
import {audioLink} from '@/lib/audio-link.mjs';
type Import={id:string;name:string;status:string;error?:string};
export default function LinkImport({disabled,onFile,onBusy}:{disabled:boolean;onFile:(file:File)=>void;onBusy:(busy:boolean)=>void}){
 const [url,setUrl]=useState(''),[rights,setRights]=useState(false),[items,setItems]=useState<Import[]>([]),[online,setOnline]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const abort=useRef<AbortController|null>(null),alive=useRef(true);
 async function refresh(){try{const data=await api('audio-imports');if(alive.current){setItems(data.imports);setOnline(data.online)}}catch(e){if(alive.current)setMessage((e as Error).message)}}
 useEffect(()=>{alive.current=true;void refresh();const timer=setInterval(refresh,5000);return()=>{alive.current=false;clearInterval(timer);abort.current?.abort()}},[]);
 async function fetchFile(source:string,name:string){
  const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),90000);
  try{
   const response=await fetch(source,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok||!response.body)throw Error('Audio download failed. Check the link or upload the file.');
   if(Number(response.headers.get('content-length'))>25*1024**2)throw Error('Audio must be no larger than 25 MB.');
   if((response.headers.get('content-type')||'').includes('text/html'))throw Error('This link points to a webpage, not an audio file.');
   const reader=response.body.getReader(),parts:BlobPart[]=[];let total=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>25*1024**2)throw Error('Audio must be no larger than 25 MB.');parts.push(value);if(alive.current)setMessage(`Downloading ${(total/1024**2).toFixed(1)} MB...`);}}finally{await reader.cancel();}
   if(!total)throw Error('The audio file is empty.');
   if(alive.current){onFile(new File(parts,name,{type:response.headers.get('content-type')||'audio/mpeg'}));setMessage('Audio added. Choose your output settings and convert.');}
  }finally{clearTimeout(timeout);abort.current=null;}
 }
 async function run(action:()=>Promise<void>){if(loading||disabled)return;setLoading(true);onBusy(true);setMessage('');try{await action()}catch(e){if(alive.current)setMessage((e as Error).name==='AbortError'?'Download cancelled or timed out. Retry when ready.':(e as Error).message==='Failed to fetch'?'The source blocked browser access (CORS), or the connection failed. Download the file and upload it here.':(e as Error).message)}finally{if(alive.current){setLoading(false);onBusy(false)}}}
 return <section className="sound-link"><h3><Link2 size={17}/> Import from a link</h3><p>YouTube, TikTok, Instagram, Facebook, X, SoundCloud, or a direct audio-file URL.</p><label>Audio or video URL<input type="url" value={url} disabled={loading||disabled} placeholder="https://..." onChange={e=>setUrl(e.target.value)}/></label><label className="sound-rights"><input type="checkbox" checked={rights} disabled={loading||disabled} onChange={e=>setRights(e.target.checked)}/>I have permission to download and use this audio.</label><button className="subtle-button" disabled={loading||disabled||!rights||!url.trim()} onClick={()=>run(async()=>{const link=audioLink(url.trim());if(link.kind==='direct'){const name=decodeURIComponent(new URL(link.url).pathname.split('/').pop()||'audio.mp3');await fetchFile(link.url,name);}else{await api('audio-imports',{method:'POST',body:JSON.stringify({url:link.url,rights})});setMessage('Link queued. When ready, select Use audio below.');await refresh();}})}>{loading?<LoaderCircle className="spin" size={16}/>:<Download size={16}/>} Import audio</button>{loading&&abort.current&&<button className="text-button" onClick={()=>abort.current?.abort()}>Cancel download</button>}<small>Social links: one video, up to 20 minutes / 100 MB source. 10 imports per day. Imports use MP3 128 kbps as the source for conversion and expire after 24 hours. Downloads use the local processor{online?' (online).':' (currently offline; queued links will wait).'}</small>{message&&<p role="status" className="sound-warning">{message}</p>}<div className="sound-imports">{items.map(item=><article key={item.id}><div><strong>{item.name}</strong><span>{item.status==='queued'?(online?'Queued':'Waiting for processor'):item.status==='running'?'Downloading & extracting audio':item.status}</span>{item.error&&<p>{item.error}</p>}</div>{item.status==='complete'&&<button className="subtle-button" disabled={loading||disabled} onClick={()=>run(async()=>{const data=await api('audio-imports/'+item.id,{method:'POST',body:JSON.stringify({action:'load'})});await fetchFile(data.url,data.name);})}>Use audio</button>}<button className="icon-button" disabled={loading||disabled} aria-label={'Remove import '+item.name} onClick={()=>run(async()=>{await api('audio-imports/'+item.id,{method:'DELETE'});await refresh();})}><X size={16}/></button></article>)}</div></section>
}
