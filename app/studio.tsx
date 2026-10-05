"use client";
import { useEffect, useState, useRef } from 'react';
import { Scissors, Plus, FolderOpen, ArrowUpRight, Upload, Film, Clock3, Check, ChevronDown, Settings2, Sparkles, MonitorPlay, Trash2, ExternalLink, LoaderCircle, HardDrive, Captions, Crop, History } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Toaster, toast } from 'sonner';
import { api, Project, timestamp } from '@/lib/types';
import Editor from './editor';
import Billing from './billing';
export function Choice({ value, onChange, items, label }: {
    value: string;
    onChange: (v: string) => void;
    items: [
        string,
        string
    ][];
    label: string;
}) { return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue /></SelectTrigger><SelectContent>{items.map(([v, l]) => <SelectItem value={v} key={v}>{l}</SelectItem>)}</SelectContent></Select>; }
export default function Studio() {
    const [open, setOpen] = useState(false), [settings, setSettings] = useState(false), [account, setAccount] = useState<any>({ name: 'Your account', email: '', processorConfigured: false, processorOnline: false }), [projects, setProjects] = useState<Project[]>([]), [usage, setUsage] = useState({ uploads: 0, seconds: 0 }), [bytes, setBytes] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState(''), [selected, setSelected] = useState<string | null>(null), [deleteId, setDeleteId] = useState<string | null>(null), [theme, setTheme] = useState('dark'), [resume, setResume] = useState<Project | null>(null);
    const [section,setSection]=useState('clip');
    const [billing,setBilling]=useState(false),[adminOpen,setAdminOpen]=useState(false);
    const editorBack=useRef<null|(()=>Promise<void>)>(null);
    async function refresh() { try {
        const d = await api('projects');
        setProjects(d.projects);
        setUsage(d.usage);
        setBytes(d.storage.bytes);
        setError('');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { refresh(); api('account').then(setAccount).catch(() => { }); api('events', { method: 'POST', body: JSON.stringify({ name: 'visit' }) }).catch(() => { }); const saved = localStorage.getItem('loofy-theme'); if (saved)
        setTheme(saved); const timer = setInterval(() => { refresh(); api('account').then(setAccount).catch(() => { }); }, 6000); return () => clearInterval(timer); }, []);
    useEffect(() => { localStorage.setItem('loofy-theme', theme); const m = matchMedia('(prefers-color-scheme: dark)'); const sync = () => document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'system' && m.matches); sync(); m.addEventListener('change', sync); return () => m.removeEventListener('change', sync); }, [theme]);
    useEffect(() => { const context = (document as any).modelContext; if (!context?.registerTool)
        return; const lifecycle = new AbortController(); Promise.resolve(context.registerTool({ name: 'start_video_import', description: 'Open the video import form. Does not upload a file or create a project.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input: unknown) { if (!input || typeof input !== 'object' || Object.keys(input).length)
            throw Error('Expected an empty object.'); setOpen(true); return { form: 'video_import', opened: true }; } }, { signal: lifecycle.signal })).catch(() => { }); return () => lifecycle.abort(); }, []);
    function start() { setResume(null); setOpen(true); }
    async function remove() { try {
        if (deleteId === 'account') {
            await api('account', { method: 'DELETE' });
            setSelected(null);
            setSettings(false);
            toast.success('Workspace data deleted.');
        }
        else {
            await api('projects/' + deleteId, { method: 'DELETE' });
            if (selected === deleteId)
                setSelected(null);
            toast.success('Project deleted.');
        }
        setDeleteId(null);
        refresh();
    }
    catch (e) {
        toast.error((e as Error).message);
    } }
    const initials = account.name.slice(0, 1).toUpperCase();
    return <SidebarProvider><div className={"studio-shell "+(selected?"is-editing":"")}><aside className="rail"><a className="brand" href="/"><span className="brand-icon"><Scissors size={23}/></span><span className="brand-name">loofy<span className="brand-light">clip</span></span></a><div className="workspace"><span className="avatar">{initials}</span><div>Your workspace<small>Personal workspace</small></div><ChevronDown size={15}/></div><span className="eyebrow">WORKSPACE</span><SidebarMenu><SidebarMenuItem><SidebarMenuButton className={"nav-link "+(!selected?"active":"")} onClick={() => selected&&editorBack.current?editorBack.current():setSelected(null)}><FolderOpen size={18}/><span className="nav-label">Projects</span><span className="count">{projects.length}</span></SidebarMenuButton></SidebarMenuItem>{selected&&[{key:"clip",label:"Clip",Icon:Scissors},{key:"caption",label:"Caption",Icon:Captions},{key:"crop",label:"Crop",Icon:Crop},{key:"history",label:"History",Icon:History}].map(({key,label,Icon})=><SidebarMenuItem key={key}><SidebarMenuButton className={"nav-link tool-nav "+(section===key?"active":"")} onClick={()=>setSection(key)}><Icon size={20}/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><a className="nav-link ugc-nav-entry" href="/ugc"><Sparkles size={18}/><span>AI UGC Studio</span></a><div className="rail-bottom"><div className="beta-card"><span className="beta-label">PRIVATE BETA</span><h3>Your daily creative credits.</h3><p>Your next great clip starts here.</p><div className="quota-track"><i style={{ width: Math.min(100,(account.credits?.free||0)/Math.max(1,account.credits?.daily||10)*100) + '%' }}/></div><small>{account.credits?.unlimited?"Unlimited admin credits":`${account.credits?.free ?? 0} daily + ${account.credits?.paid ?? 0} subscription credits`}</small></div><button className="nav-link" onClick={() => setSettings(true)}><Settings2 size={18}/><span className="settings-label">Settings</span></button><button className="nav-link" onClick={()=>setBilling(true)}>Credits & subscription</button>{account.credits?.admin&&<button className="nav-link" onClick={()=>setAdminOpen(true)}>Administration</button>}<button className="profile" onClick={() => setSettings(true)}><span className="avatar orange">{initials}</span><div>{account.name}<small>Credits reset daily at 00:00 WIB</small></div></button></div></aside><div className="main-area"><header className="topbar"><span>Workspace <b>/</b> {selected ? 'Clip editor' : 'All projects'}</span><div className="inline"><button className="icon-button mobile-settings" aria-label="Workspace settings" onClick={() => setSettings(true)}><Settings2 size={18}/></button><span className="beta-label">FREE BETA</span></div></header>{selected ? <Editor key={selected} id={selected} section={section} onSection={setSection} backRef={editorBack} configured={account.processorOnline} onBack={() => { setSelected(null); refresh(); }}/> : <main><div className="page-heading"><div><div className="eyebrow">YOUR CREATIVE WORKSPACE</div><h1>All projects<span>.</span></h1><p>Find the moments worth sharing.</p></div><button className="primary" onClick={start}><Plus size={18}/> New project</button></div><section className="import-banner"><div><span className="pill"><Sparkles size={14}/> LESS EDITING. MORE CREATING.</span><h2>Long video.<br /><span>Great little moments.</span></h2><p>Upload your video. Find your highlights.<br />Make something worth watching.</p><button className="white-button" onClick={start}>{projects.length ? 'Create a new clip' : 'Create your first clip'} <ArrowUpRight size={18}/></button></div><button className="drop-card" onClick={start}><span className="upload-symbol"><Upload size={26}/></span><strong>Bring your next big idea here</strong><span>Click to upload a video</span><small>MP4 or MOV · Up to 2 GB · 60 min max</small></button></section><a className="ugc-discovery" href="/ugc"><span className="ugc-discovery-icon"><Sparkles size={25}/></span><div><span>NEW WORKSPACE</span><h3>Meet AI UGC Studio</h3><p>Shape your next product story with images, scripts and creative direction.</p></div><span className="ugc-discovery-action">Open studio <ArrowUpRight size={18}/></span></a><div className="stats-row">{[{ Icon: Film, label: 'Source videos this month', value: `${usage.uploads}` }, { Icon: Clock3, label: 'Minutes this month', value: `${Math.ceil(usage.seconds / 60)}` }, { Icon: Scissors, label: 'Clips created', value: projects.reduce((n, p) => n + p.clipCount, 0) }].map(({ Icon, label, value }) => <div className="stat" key={label}><span className="stat-icon"><Icon size={20}/></span><div><span>{label}</span><strong>{value}</strong></div></div>)}</div><section className="project-section"><div className="section-heading"><h2>Your projects <span>{projects.length}</span></h2><span>Most recent first</span></div>{error ? <div className="notice error" role="alert">{error} <button onClick={refresh}>Try again</button>{!account.email && <a href="/login" target="_top">Sign in</a>}</div> : loading ? <div className="empty-projects" role="status"><LoaderCircle className="spin"/> Loading your projects…</div> : projects.length ? <div className="project-grid">{projects.map(p => <article className="project-card" key={p.id}><button className="project-preview" onClick={() => p.status === 'uploading' ? (setResume(p), setOpen(true)) : setSelected(p.id)}>{p.status !== 'uploading' ? <video src={`/api/projects/${p.id}/source#t=0.1`} preload="metadata" muted/> : <Film size={34}/>}<span className="duration">{timestamp(p.duration)}</span><span className={'status ' + p.status}>{p.status === 'no_speech' ? 'No speech' : p.status === 'finding highlights' ? 'Finding highlights' : p.status}</span></button><div className="project-card-body"><button className="project-title" onClick={() => setSelected(p.id)}>{p.name.replace(/\.(mp4|mov)$/i, '')}</button><div className="project-meta"><span>{p.clipCount} clips · {p.language === 'auto' ? 'Auto language' : p.language === 'id' ? 'Indonesian' : 'English'}</span><button className="icon-button" aria-label={`Delete ${p.name}`} onClick={() => setDeleteId(p.id)}><Trash2 size={15}/></button></div></div></article>)}</div> : <div className="empty-projects"><div className="empty-icon"><MonitorPlay size={29}/></div><h3>A blank canvas for your best moments</h3><p>Your videos and clips will live here.<br />Add a source video to get things rolling.</p><button className="subtle-button" onClick={start}><Plus size={17}/> Add a video</button></div>}</section><footer><span><Check size={14}/> Your projects stay private.</span><span>Made for your next great clip.</span></footer></main>}</div><Dialog open={billing} onOpenChange={setBilling}><DialogContent style={{maxHeight:"85vh",overflowY:"auto"}}><DialogTitle>Credits & subscription</DialogTitle><DialogDescription>Manage your processing allowance.</DialogDescription><Billing/></DialogContent></Dialog><Dialog open={adminOpen} onOpenChange={setAdminOpen}><DialogContent style={{maxHeight:"85vh",overflowY:"auto"}}><DialogTitle>Administration</DialogTitle><DialogDescription>Manage accounts, credits and projects.</DialogDescription><Billing admin/></DialogContent></Dialog><UploadDialog credits={account.credits} open={open} onClose={() => setOpen(false)} usage={usage} bytes={bytes} resume={resume} onDone={pid => { setOpen(false); setSelected(pid); refresh(); }}/><Dialog open={settings} onOpenChange={setSettings}><DialogContent><DialogTitle>Workspace settings</DialogTitle><DialogDescription>Your personal creative space.</DialogDescription><label className="field">Appearance<Choice label="Theme" value={theme} onChange={setTheme} items={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]}/></label><div className="notice"><HardDrive size={18}/> {(bytes / 1024 ** 3).toFixed(2)} of 10 GB storage used</div><div className="field"><span>How is Loofy Clip working for you?</span><div className="inline">{[1, 2, 3, 4, 5].map(n => <button className="subtle-button" key={n} aria-label={`Rate ${n} out of 5`} onClick={() => api('events', { method: 'POST', body: JSON.stringify({ name: 'feedback', value: n }) }).then(() => toast.success('Thanks for your feedback.')).catch(e => toast.error(e.message))}>{n}</button>)}</div></div><div className="account-actions"><form action="/auth/signout" method="post"><button className="subtle-button" type="submit">Sign out <ExternalLink size={14}/></button></form><button className="danger-button" onClick={() => setDeleteId('account')}>Delete workspace data</button></div><p className="fine-print">Deleting workspace data removes your uploads, transcripts, clips, and exports. Credit and subscription records remain; deleting projects does not reset your credits. Your ChatGPT account is unaffected.</p></DialogContent></Dialog><AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}><AlertDialogContent><AlertDialogTitle>{deleteId === 'account' ? 'Delete all workspace data?' : 'Delete this project?'}</AlertDialogTitle><AlertDialogDescription>This permanently removes the source video, transcript, clips, and exports. This cannot be undone.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); remove(); }} className="danger-button">Delete permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Toaster richColors position="bottom-right"/></div></SidebarProvider>;
}
function UploadDialog({ credits, open, onClose, usage, bytes, resume, onDone }: {
    open: boolean;
    credits?: {free:number;paid:number;unlimited?:boolean};
    onClose: () => void;
    usage: {
        uploads: number;
        seconds: number;
    };
    bytes: number;
    resume: Project | null;
    onDone: (id: string) => void;
}) {
    const uploadRequest = useRef('');
    const [mode,setMode]=useState('file'), [file, setFile] = useState<File | null>(null), [duration, setDuration] = useState(0), [language, setLanguage] = useState('auto'), [youtube, setYoutube] = useState(''), [rights, setRights] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [pendingId, setPendingId] = useState<string | null>(null);
    useEffect(() => { if (open) {
        uploadRequest.current = crypto.randomUUID();
        setMode("file");
        setFile(null);
        setDuration(0);
        setError('');
        setProgress(0);
        setPendingId(resume?.id || null);
        setRights(false);
    } }, [open, resume]);
    async function choose(f: File | undefined) { setError(''); setDuration(0); setFile(null); if (!f)
        return; if (!/\.(mp4|mov)$/i.test(f.name) || f.size > 2 * 1024 ** 3) {
        setError('Choose an MP4 or MOV video no larger than 2 GB.');
        return;
    } const url = URL.createObjectURL(f), v = document.createElement('video'); v.preload = 'metadata'; v.src = url; const cleanup = () => { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); }; v.onloadedmetadata = () => { const d = v.duration; cleanup(); if (!Number.isFinite(d) || d <= 0 || d > 3600) {
        setError('Your video must be no longer than 60 minutes.');
        return;
    } if (resume && (f.size !== resume.size || f.name !== resume.name)) {
        setError('Choose the same source file to resume this upload.');
        return;
    } setDuration(d); setFile(f); }; v.onerror = () => { cleanup(); setError('This browser cannot read the video. Try an H.264 MP4 or a compatible MOV file.'); }; }
    async function upload() { if(mode==='youtube'){setBusy(true);setError('');try{const p=await api('projects/youtube',{method:'POST',headers:{'Idempotency-Key':uploadRequest.current},body:JSON.stringify({url:youtube,language,rights})});onDone(p.id)}catch(e){setError((e as Error).message)}finally{setBusy(false)}return;} if (!file || !rights)
        return; setBusy(true); setError(''); try {
        const created = pendingId ? { id: pendingId, partSize: 8 * 1024 * 1024 } : await api('projects', { method: 'POST', headers: { 'Idempotency-Key': uploadRequest.current }, body: JSON.stringify({ name: file.name, size: file.size, duration, language, youtube, rights }) });
        setPendingId(created.id);
        const parts: {partNumber:number;etag:string}[] = [];
        for (let offset = 0; offset < file.size; offset += created.partSize) {
            const n = parts.length + 1;
            const chunk = file.slice(offset, offset + created.partSize);
            let part: {partNumber:number;etag:string} | undefined;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const signed = await api(`projects/${created.id}/part/${n}`, { method: 'POST', body: JSON.stringify({size: chunk.size}) });
                    const uploaded = await fetch(signed.url, {method: 'PUT', body: chunk});
                    if (!uploaded.ok) throw new Error('Storage upload failed. Retry this upload.');
                    const etag = uploaded.headers.get('ETag');
                    if (!etag) throw new Error('Storage CORS must expose ETag. Contact the administrator.');
                    part = {partNumber:n, etag};
                    break;
                }
                catch (e) {
                    if (attempt === 2)
                        throw e;
                }
            }
            if (!part) throw new Error('Upload part failed. Please retry.');
            parts.push(part);
            setProgress(Math.round(Math.min(offset + created.partSize, file.size) / file.size * 100));
        }
        await api(`projects/${created.id}/complete`, { method: 'POST', body: JSON.stringify({ parts }) });
        onDone(created.id);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <Dialog open={open} onOpenChange={v => !v && !busy && onClose()}><DialogContent className="upload-dialog" onInteractOutside={e => busy && e.preventDefault()}><DialogTitle>{resume ? 'Resume upload' : 'Start with a great video'}</DialogTitle><DialogDescription>We’ll find the moments. You make them yours.</DialogDescription>{!resume&&<label className="field">Source<Choice label="Source type" value={mode} onChange={setMode} items={[["file","Upload file"],["youtube","YouTube link"]]}/></label>}{mode==="file"&&<label className="file-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy)
        choose(e.dataTransfer.files[0]); }}><Upload size={27}/><strong>{file ? file.name : 'Choose a video or drop it here'}</strong><span>{file ? `${timestamp(duration)} · ${(file.size / 1024 ** 2).toFixed(1)} MB` : 'MP4 or MOV · Up to 2 GB · 60 min max'}</span><input disabled={busy} aria-label="Source video" type="file" accept=".mp4,.mov,video/mp4,video/quicktime" onChange={e => choose(e.target.files?.[0])}/></label>}<div className="form-row"><label className="field">Video language<Choice label="Video language" value={language} onChange={setLanguage} items={[["auto", "Detect automatically"], ["en", "English"], ["id", "Indonesian"]]}/></label><div className="field allowance"><span>Monthly allowance</span><strong>{5 - usage.uploads} uploads · {Math.max(0, 120 - Math.ceil(usage.seconds / 60))} min left</strong><small>{(10 - bytes / 1024 ** 3).toFixed(1)} GB storage remaining</small></div></div><label className="field">{mode==="youtube"?"YouTube video link":"YouTube reference (optional)"}<input disabled={busy || !!resume} type="url" placeholder="https://youtube.com/watch?v=…" value={youtube} onChange={e => setYoutube(e.target.value)}/><small>{mode==="youtube"?"Paste one public video link. Processing continues in the background. Up to 60 minutes; sufficient credits required.":"For reference only. Upload the original video above."}</small></label><label className="check-label"><Checkbox checked={rights} onCheckedChange={v => setRights(v === true)} disabled={busy}/> I have permission to process and create clips from this video.</label>{busy && <div role="status"><Progress value={progress}/><p className="fine-print">Uploading {progress}% — keep this window open.</p></div>}{error && <p className="notice error" role="alert">{error}</p>}<button className="primary wide" onClick={upload} disabled={(mode==="file"?!file:!youtube) || !rights || busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <Sparkles size={17}/>} {busy ? 'Uploading your video…' : pendingId ? 'Retry upload' : mode==='youtube'?'Import YouTube video':'Upload & find highlights'}</button></DialogContent></Dialog>;
}
