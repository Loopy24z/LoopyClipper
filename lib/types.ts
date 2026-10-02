export type Word = {
    start: number;
    end: number;
    text: string;
};
export type ClipData = {
    title: string;
    description: string;
    start: number;
    end: number;
    ratio: string;
    fit: string;
    position: number;
    captions: boolean;
    fontSize: number;
    font?: string;
    textEffect?: string;
    color: string;
    background: string;
    captionText?: string | null;
    reason?: string;
};
export type Clip = {
    id: string;
    project: string;
    suggested: number;
    data: ClipData;
};
export type Job = {
    id: string;
    clip: string | null;
    kind: string;
    status: string;
    progress: number;
    error?: string;
    created: number;
};
export type Project = {
    id: string;
    name: string;
    size: number;
    duration: number;
    language: string;
    youtube: string;
    status: string;
    error?: string;
    created: number;
    clipCount: number;
    transcript: Word[];
    clips: Clip[];
    jobs: Job[];
};
export const timestamp = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export const defaults = (duration: number): ClipData => ({ title: 'Untitled clip', description: '', start: 0, end: Math.min(45, duration), ratio: '9:16', fit: 'cover', position: 50, captions: true, fontSize: 36, color: '#ffffff', background: '#000000', captionText: null });
export async function api(path: string, options: RequestInit = {}): Promise<any> { const response = await fetch('/api/' + path, { ...options, headers: { ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); const data: any = await response.json(); if (!response.ok)
    throw Error(data.error || 'Please try again.'); return data; }
