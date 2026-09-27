"use client";
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ArrowLeft, Scissors, Sparkles, Download, Check, Plus, Copy, RefreshCw, LoaderCircle, Play, Pause, FileText, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { api, Project, Clip, ClipData, defaults, timestamp } from '@/lib/types';
import { Choice } from './studio';
function ExportHistory({project,onRetry}:{project:Project;onRetry:(id:string)=>Promise<void>}){
 const exports=project.jobs.filter(j=>j.kind==='export');
 return <div className="style-controls history-panel"><div className="tool-panel-heading"><span className="eyebrow">YOUR OUTPUTS</span><h2>Render history</h2></div>{exports.length?exports.map(j=><div className="history-item" key={j.id}><div className="inline"><Download size={16}/><strong>{project.clips.find(c=>c.id===j.clip)?.data.title||'Exported clip'}</strong></div><span className="muted">{j.status} · {new Date(j.created).toLocaleString()}</span>{j.error&&<p className="error">{j.error}</p>}{j.status==='running'&&<Progress value={j.progress}/>} {j.status==='complete'?<a className="primary" href={`/api/exports/${j.id}`} download><Download size={14}/> Download MP4</a>:j.status==='failed'&&j.clip?<button className="subtle-button" onClick={()=>onRetry(j.clip!)}><RefreshCw size={14}/> Retry render</button>:<span className="muted">Your clip is in the render queue.</span>}</div>):<div className="history-empty"><Download size={27}/><h3>Your renders will live here</h3><p>Choose a clip and export it to create your first MP4.</p></div>}</div>
}
export default function Editor({ id, configured, onBack, section, onSection, backRef }: {
    section:string; onSection:(section:string)=>void; backRef:MutableRefObject<null|(()=>Promise<void>)>;
    id: string;
    configured: boolean;
    onBack: () => void;
}) {
    const [p, setP] = useState<Project | null>(null), [active, setActive] = useState<Clip | null>(null), [error, setError] = useState(''), [saveState, setSaveState] = useState('Saved'), [busy, setBusy] = useState(false), [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [selection, setSelection] = useState<[
        number,
        number
    ] | null>(null), [transcriptEdit, setTranscriptEdit] = useState(false), [wordEdits, setWordEdits] = useState<string[]>([]);
    const video = useRef<HTMLVideoElement>(null), saveQueue = useRef(Promise.resolve()), dirty = useRef(false), current = useRef<Clip | null>(null), selectedWord = useRef<number | null>(null), saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const select = (c: Clip) => { setActive(c); current.current = c; dirty.current = false; if (video.current)
        video.current.currentTime = c.data.start; };
    async function load() { try {
        const d = await api('projects/' + id);
        setP(d);
        setError('');
        if ((!current.current || !d.clips.some((c:Clip)=>c.id===current.current?.id)) && d.clips.length)
            select(d.clips[0]);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { load(); const timer = setInterval(load, 4000); return () => { clearInterval(timer); if (saveTimer.current)
        clearTimeout(saveTimer.current); if (dirty.current && current.current)
        void save(current.current); }; }, [id]);
    useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, []);
    async function save(c: Clip) { setSaveState('Saving…'); const snapshot = JSON.stringify(c.data); const operation = saveQueue.current.catch(() => { }).then(async () => { await api('clips/' + c.id, { method: 'PUT', body: snapshot });
        setP(old=>old?{...old,clips:old.clips.map(item=>item.id===c.id?{...item,data:JSON.parse(snapshot),suggested:0}:item)}:old); if (current.current?.id === c.id && JSON.stringify(current.current.data) === snapshot) {
        dirty.current = false;
        setSaveState('Saved');
    } }); saveQueue.current = operation; try {
        await operation;
    }
    catch (e) {
        setSaveState('Save failed — retry');
        throw e;
    } }
    function edit(change: Partial<ClipData>) { if (!current.current)
        return; const next = { ...current.current, data: { ...current.current.data, ...change } }; current.current = next; setActive(next); dirty.current = true; setSaveState('Unsaved changes'); if (saveTimer.current)
        clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => { save(next).catch(() => { }); }, 650); }
    async function flush() { if (saveTimer.current)
        clearTimeout(saveTimer.current); if (dirty.current && current.current)
        await save(current.current);
    else
        await saveQueue.current.catch(() => { }); }
    backRef.current=async()=>{try{await flush();onBack()}catch(e){toast.error((e as Error).message)}};
    async function switchClip(c: Clip) { try {
        await flush();
        if(current.current?.id!==c.id)select(c);
    }
    catch (e) {
        toast.error((e as Error).message);
    } }
    async function create(fromSelection = false) { if (!p)
        return; setBusy(true); try {
        await flush();
        const d = defaults(p.duration);
        if (fromSelection && selection) {
            d.start = p.transcript[selection[0]].start;
            d.end = p.transcript[selection[1]].end;
            d.title = p.transcript.slice(selection[0], selection[1] + 1).map(w => w.text).join(' ').slice(0, 100);
        }
        const c = await api(`projects/${id}/clips`, { method: 'POST', body: JSON.stringify(d) });
        select(c);
        await load();
        setSelection(null);
        toast.success('Clip created.');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function exportClip() { if (!active)
        return; setBusy(true); try {
        await flush();
        await api(`clips/${active.id}/export`, { method: 'POST' });
        await load();
        toast.success('Export queued. You can keep editing.');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function regenerate() { if (!active)
        return; try {
        await flush();
        edit(await api(`clips/${active.id}/describe`, { method: 'POST' }));
    }
    catch (e) {
        toast.error((e as Error).message);
    } }
    function captureSelection() { const s = window.getSelection(); if (!s || s.isCollapsed)
        return; const node = (n: Node | null) => n?.nodeType === 3 ? n.parentElement : n as HTMLElement; const a = node(s.anchorNode)?.closest('[data-word]'), b = node(s.focusNode)?.closest('[data-word]'); if (a && b) {
        const indices = [Number(a.getAttribute('data-word')), Number(b.getAttribute('data-word'))].sort((a, b) => a - b);
        setSelection([indices[0], indices[1]]);
    } }
    async function saveTranscript() { if (!p)
        return; try {
        await api(`projects/${id}/transcript`, { method: 'PUT', body: JSON.stringify({ words: wordEdits }) });
        setTranscriptEdit(false);
        await load();
        toast.success('Transcript updated.');
    }
    catch (e) {
        toast.error((e as Error).message);
    } }
    if (!p)
        return <main><button className="text-button" onClick={onBack}><ArrowLeft size={16}/> All projects</button><div className="empty-projects">{error || 'Opening your project…'}{error && <button className="subtle-button" onClick={load}>Retry</button>}</div></main>;
    const data = active?.data, ready = ['ready', 'no_speech'].includes(p.status), jobs = p.jobs.filter(j => j.clip === active?.id && j.kind === 'export');
    const relevant = p.transcript.filter(w => data && w.end > data.start && w.start < data.end);
    let caption = '';
    for (let i = 0; i < relevant.length; i += 6) {
        const group = relevant.slice(i, i + 6);
        if (time >= group[0].start && time <= group[group.length - 1].end) {
            caption = group.map(w => w.text).join(' ');
            break;
        }
    }
    if (data?.captionText)
        caption = data.captionText;
    return <main className="editor-main"><div className="editor-heading"><div><button className="text-button" onClick={async () => { try {
        await flush();
        onBack();
    }
    catch (e) {
        toast.error((e as Error).message);
    } }}><ArrowLeft size={15}/> All projects</button><h1>{p.name.replace(/\.(mp4|mov)$/i, '')}</h1><div className="inline muted"><span>{timestamp(p.duration)} · {p.language === 'id' ? 'Indonesian' : p.language === 'en' ? 'English' : 'Auto language'}</span>{p.youtube && <a href={p.youtube} target="_blank" rel="noreferrer" className="inline">YouTube source <ExternalLink size={12}/></a>}</div></div><div className="inline"><button className="save-indicator" onClick={() => active && save(active).catch(e => toast.error(e.message))}><Check size={14}/>{saveState}</button><button className="primary" disabled={!active || busy} onClick={exportClip}><Download size={16}/> Export clip</button></div></div>{error && <div className="notice error" role="alert">{error}</div>}{!ready && <div className="processing-card"><div className="empty-icon">{p.status === 'failed' ? <RefreshCw /> : <LoaderCircle className="spin"/>}</div><h2>{p.status === 'failed' ? 'Your video needs another try' : p.status === 'uploading' ? 'Your upload is incomplete' : p.status === 'queued' ? 'Your video is in the queue' : p.status === 'downloading' ? 'Downloading your YouTube video' : p.status === 'transcribing' ? 'Turning speech into text' : 'Finding your best moments'}</h2><p>{p.error || (p.status === 'uploading' ? 'Return to your projects and choose the same file to resume.' : !configured ? 'Your upload is saved. Video processing is waiting for the workspace’s processing service to come online.' : 'You can leave this page. Your video will keep processing in the background.')}</p><div className="process-steps">{['Uploaded', 'Transcribing', 'Highlights', 'Ready'].map((s, i) => <span key={s} className={i === 0 ? 'done' : ''}>{i === 0 ? <Check size={15}/> : i + 1} {s}</span>)}</div>{p.status === 'failed' && <button className="primary" onClick={() => api(`projects/${id}/retry`, { method: 'POST' }).then(load).catch(e => toast.error(e.message))}><RefreshCw size={16}/> Retry processing</button>}</div>}<><div className="editor-grid"><section className="preview-panel"><div className="panel-title"><span>Clip preview</span><span>{data?.ratio || 'Original'}</span></div><div className="video-stage"><div className="video-frame" style={{ aspectRatio: data?.ratio.replace(':', '/') || '16/9', maxHeight: 420 }}><video ref={video} src={`/api/projects/${id}/source`} style={{ objectFit: (data?.fit || 'contain') as 'contain' | 'cover', objectPosition: `${data?.position ?? 50}% 50%` }} playsInline onTimeUpdate={e => { const v = e.currentTarget; setTime(v.currentTime); if (data && v.currentTime >= data.end && !v.paused) {
        v.pause();
        setPlaying(false);
    } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedMetadata={() => { if (video.current && data)
        video.current.currentTime = data.start; }}/>{data?.captions && caption && <div className="caption-preview" style={{ color: data.color, backgroundColor: (data.textEffect||"box")==="box"?data.background:"transparent", fontFamily: data.font==="serif"?"Times New Roman, serif":data.font==="mono"?"Courier New, monospace":"Arial, sans-serif", fontWeight:data.textEffect==="bold"?700:400, WebkitTextStroke:data.textEffect==="outline"?`0.035em ${data.background}`:undefined, paintOrder:"stroke fill", textShadow:data.textEffect==="shadow"?`0.035em 0.035em 0 ${data.background}`:undefined, fontSize: `${data.fontSize / (data.ratio==='16:9'?1920:1080) * 100}cqw` }}>{caption}</div>}</div></div><div className="playback"><button className="play-button" aria-label={playing ? 'Pause' : 'Play clip'} onClick={() => { const v = video.current; if (!v)
        return; if (playing)
        v.pause();
    else {
        if (data && (v.currentTime < data.start || v.currentTime >= data.end))
            v.currentTime = data.start;
        v.play().catch(() => toast.error('This browser cannot play the source video.'));
    } }}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button><span>{timestamp(time)} <b>/ {timestamp(p.duration)}</b></span><Slider aria-label="Playback position" min={0} max={p.duration} step={.1} value={[time]} onValueChange={([v]) => { if (video.current) {
        video.current.currentTime = v;
        setTime(v);
    } }}/></div>{data && <div className="trim-panel"><div className="panel-title"><span><Scissors size={14}/> Trim your moment</span><span>{(data.end - data.start).toFixed(1)}s</span></div><Slider aria-label="Clip start and end" min={0} max={p.duration} step={.1} minStepsBetweenThumbs={1} value={[data.start, data.end]} onValueChange={([start, end]) => edit({ start, end })}/><div className="form-row"><label className="field">Start (seconds)<input type="number" step="0.1" min="0" max={data.end - .1} value={Number(data.start.toFixed(2))} onChange={e => edit({ start: Number(e.target.value) })}/></label><label className="field">End (seconds)<input type="number" step="0.1" min={data.start + .1} max={p.duration} value={Number(data.end.toFixed(2))} onChange={e => edit({ end: Number(e.target.value) })}/></label></div></div>}</section><section className="edit-panel"><Tabs value={section==='transcript'?'transcript':'style'} onValueChange={v=>onSection(v==='transcript'?v:'clip')}><TabsList className="editor-tabs"><TabsTrigger value="transcript"><FileText size={15}/> Transcript</TabsTrigger><TabsTrigger value="style"><SlidersHorizontal size={15}/> Clip options</TabsTrigger></TabsList><TabsContent value="transcript"><div className="transcript-toolbar"><p>Highlight words to create a clip.</p><button className="text-button" onClick={() => { if (transcriptEdit)
        saveTranscript();
    else {
        setWordEdits(p.transcript.map(w => w.text));
        setTranscriptEdit(true);
    } }}>{transcriptEdit ? 'Save text' : 'Edit text'}</button></div><div className="transcript" onMouseUp={captureSelection}>{!p.transcript.length ? <p className="muted">{ready?'No speech detected. You can still create a clip manually.':'Your transcript will appear here when processing finishes.'}</p> : transcriptEdit ? <div className="word-editor">{p.transcript.map((w, i) => <input key={i} aria-label={`Word at ${timestamp(w.start)}`} value={wordEdits[i] || ''} onChange={e => setWordEdits(all => all.map((t, j) => i === j ? e.target.value : t))}/>)}</div> : p.transcript.map((w, i) => <span key={i}>{i % 24 === 0 && <span className="transcript-time">{timestamp(w.start)}</span>}<button data-word={i} className={'word ' + (time >= w.start && time <= w.end ? 'current ' : '') + (selection && i >= selection[0] && i <= selection[1] ? 'selected' : '')} onClick={e => { if (e.shiftKey && selectedWord.current !== null)
        setSelection([Math.min(i, selectedWord.current), Math.max(i, selectedWord.current)]);
    else {
        selectedWord.current = i;
        if (video.current)
            video.current.currentTime = w.start;
    } }}>{w.text}</button>{' '}</span>)}</div><div className="transcript-bottom"><span>{selection ? `${timestamp(p.transcript[selection[0]].start)}–${timestamp(p.transcript[selection[1]].end)}` : 'Tip: Shift-click two words to select a range.'}</span><button className="primary" disabled={!selection || busy} onClick={() => create(true)}><Scissors size={15}/> Create clip</button></div></TabsContent><TabsContent value="style">{section==='history'?<ExportHistory project={p} onRetry={async cid=>{try{await api(`clips/${cid}/export`,{method:'POST'});await load()}catch(e){toast.error((e as Error).message)}}}/>:data ? <div className={"style-controls section-"+section}><div className="tool-panel-heading"><span className="eyebrow">MAKE IT YOURS</span><h2>{section==='caption'?'Caption editor':section==='crop'?'Frame your shot':'Clip options'}</h2></div><label className="field clip-setting">Clip title<input value={data.title} maxLength={150} onChange={e => edit({ title: e.target.value })}/></label><div className="form-row crop-setting"><label className="field">Aspect ratio<Choice label="Aspect ratio" value={data.ratio} onChange={ratio => edit({ ratio })} items={[["9:16", "9:16 · Vertical"], ["1:1", "1:1 · Square"], ["16:9", "16:9 · Landscape"]]}/></label><label className="field">Framing<Choice label="Framing" value={data.fit} onChange={fit => edit({ fit })} items={[["contain", "Fit full video"], ["cover", "Crop to fill"]]}/></label></div>{data.fit === 'cover' && <label className="field crop-setting">Horizontal crop position<Slider aria-label="Crop position" value={[data.position]} onValueChange={([position]) => edit({ position })}/></label>}<div className="setting-row caption-setting"><span>Show captions</span><Switch aria-label="Show captions" checked={data.captions} onCheckedChange={captions => edit({ captions })}/></div>{data.captions && <div className="caption-group"><div className="form-row"><label className="field">Font<Choice label="Caption font" value={data.font||"sans"} onChange={font=>edit({font})} items={[["sans","Sans · Arial"],["serif","Serif · Times"],["mono","Mono · Courier"]]}/></label><label className="field">Text effect<Choice label="Caption effect" value={data.textEffect||"box"} onChange={textEffect=>edit({textEffect})} items={[["box","Background box"],["outline","Outline"],["shadow","Drop shadow"],["bold","Bold"]]}/></label></div><div className="form-row"><label className="field">Size<input aria-label="Caption font size" type="number" min={16} max={72} value={data.fontSize} onChange={e => edit({ fontSize: Number(e.target.value) })}/></label><label className="field">Text color<input type="color" value={data.color} onChange={e => edit({ color: e.target.value })}/></label><label className="field">Background<input type="color" value={data.background} onChange={e => edit({ background: e.target.value })}/></label></div><label className="field">Caption override <span className="optional">optional</span><textarea rows={2} maxLength={5000} value={data.captionText || ''} placeholder="Leave empty to follow the transcript" onChange={e => edit({ captionText: e.target.value || null })}/></label></div>}<label className="field clip-setting">Description<textarea rows={4} maxLength={2000} value={data.description} onChange={e => edit({ description: e.target.value })}/></label><div className="inline clip-setting"><button className="subtle-button" onClick={regenerate}><RefreshCw size={14}/> Regenerate from transcript</button><button className="icon-button" aria-label="Copy description" onClick={() => navigator.clipboard.writeText(data.description).then(() => toast.success('Description copied.')).catch(() => toast.error('Clipboard access is unavailable. Select and copy the text.'))}><Copy size={17}/></button></div></div> : <div className="empty-projects">Create or choose a clip to customize it.</div>}</TabsContent></Tabs></section></div><div className="section-heading clip-heading"><h2><Sparkles size={18}/> Detected clips <span>{p.clips.length}</span></h2><button className="subtle-button" disabled={!ready||busy} onClick={async()=>{setBusy(true);try{await flush();await api(`projects/${id}/suggestions`,{method:"POST"});await load();toast.success("Draft suggestions refreshed. Your reviewed clips are kept.")}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}><Sparkles size={16}/> Refresh suggestions</button><button className="subtle-button" onClick={() => create()} disabled={busy||p.status==='uploading'}><Plus size={16}/> Manual clip</button></div><div className="clip-grid">{p.clips.map((c, i) => <button className={'clip-card ' + (active?.id === c.id ? 'active' : '')} key={c.id} onClick={() => switchClip(c)}><div className="clip-number">{String(i + 1).padStart(2, '0')} <span>{c.suggested ? 'SUGGESTED · REVIEW' : 'YOUR CLIP'}</span></div><h3>{c.id === active?.id ? active.data.title : c.data.title}</h3><p style={{display:"block",overflow:"visible"}}>{c.data.reason || c.data.description || 'Your next great moment.'}</p><div className="inline muted"><Scissors size={14}/>{timestamp(c.data.start)} – {timestamp(c.data.end)}<span className="clip-ratio">{c.data.ratio}</span></div></button>)}</div>{!p.clips.length && <div className="empty-projects"><p>{ready?'Select transcript text or create a manual clip.':'You can create a manual clip while highlights are processing.'}</p></div>}{jobs.length > 0 && <section className="exports"><h2>Exports for this clip</h2>{jobs.map(j => <div className="export-row" key={j.id}><Download size={18}/><div><strong>{j.status === 'complete' ? 'Ready to share' : j.status === 'failed' ? 'Export failed' : j.status === 'queued' ? 'Waiting to render' : 'Rendering your clip'}</strong>{j.error && <p className="error">{j.error}</p>}{j.status === 'running' && <Progress value={j.progress}/>}<small>{new Date(j.created).toLocaleString()}</small></div>{j.status === 'complete' ? <a className="primary" href={`/api/exports/${j.id}`} download>Download MP4</a> : j.status === 'failed' ? <button className="subtle-button" onClick={exportClip}>Retry export</button> : <LoaderCircle className="spin" size={18}/>}</div>)}</section>}</></main>;
}


