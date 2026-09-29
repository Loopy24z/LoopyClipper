"""Loofy background compute. Run on a trusted host with FFmpeg and faster-whisper.
No transcript or media bytes are written to application logs.
"""
import argparse
import json
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request
import urllib.error
import urllib.parse
import copy

MODEL = None
PART_SIZE = 8 * 1024 * 1024

def prepare_browser_source(source):
    """Normalize downloaded media before publishing it for browser playback."""
    def inspect(path):
        return json.loads(subprocess.check_output([os.getenv('FFPROBE', 'ffprobe'), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    original = inspect(source)
    videos = [s for s in original['streams'] if s['codec_type'] == 'video']
    audio = [s for s in original['streams'] if s['codec_type'] == 'audio']
    if not videos:
        raise ValueError('The source has no playable video track.')
    if videos[0]['codec_name'] == 'h264' and videos[0].get('pix_fmt') == 'yuv420p' and (not audio or audio[0]['codec_name'] == 'aac'):
        return
    normalized = source.with_name('browser-compatible.mp4')
    try:
        subprocess.run([os.getenv('FFMPEG', 'ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file,pipe', '-i', str(source), '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(normalized)], check=True, timeout=7200)
        converted = inspect(normalized)
        if abs(float(converted['format']['duration']) - float(original['format']['duration'])) > 0.5:
            raise ValueError('Video conversion changed its duration. Retry or upload the original file.')
        if normalized.stat().st_size > 2 * 1024**3:
            raise ValueError('The browser-compatible video exceeds 2 GB. Upload a smaller video.')
        normalized.replace(source)
    finally:
        normalized.unlink(missing_ok=True)

def dimensions(ratio):
    sizes = {'9:16': (1080, 1920), '1:1': (1080, 1080), '16:9': (1920, 1080)}
    if ratio not in sizes:
        raise ValueError('Unsupported aspect ratio')
    return sizes[ratio]

def stamp(seconds):
    milliseconds = max(0, round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}'

def clean_text(text):
    return re.sub(r'[<>\\{}\x00-\x08\x0b-\x1f]', '', text).strip()

def subtitle_text(words, clip):
    relevant = [w for w in words if w['end'] > clip['start'] and w['start'] < clip['end']]
    groups = [relevant[i:i+6] for i in range(0, len(relevant), 6)]
    if clip.get('captionText'):
        groups = [[{'start': clip['start'], 'end': clip['end'], 'text': clip['captionText']}]]
    output = []
    for i, group in enumerate(groups):
        start = max(0, group[0]['start'] - clip['start'])
        end = min(clip['end'] - clip['start'], group[-1]['end'] - clip['start'])
        if end > start:
            output.append(f"{i+1}\n{stamp(start)} --> {stamp(end)}\n{clean_text(' '.join(w['text'] for w in group))}\n")
    return '\n'.join(output)

def probe(source):
    result = subprocess.run([os.getenv('FFPROBE', 'ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_format', '-show_streams', '-of', 'json', str(source)], capture_output=True, text=True, timeout=60, check=True)
    data = json.loads(result.stdout)
    duration = float(data['format']['duration'])
    if not 0 < duration <= 3600 or not any(s['codec_type'] == 'video' for s in data['streams']):
        raise ValueError('The file must contain video and be no longer than 60 minutes.')
    return duration, any(s['codec_type'] == 'audio' for s in data['streams'])

def render(source, output, clip, words, preset=None, progress_file=None):
    width, height = dimensions(clip['ratio'])
    fraction = float(clip['position']) / 100
    if clip['fit'] == 'cover':
        framing = f'scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}:(iw-ow)*{fraction}:(ih-oh)/2'
    else:
        framing = f'scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black'
    filters = framing + ',setsar=1'
    if clip['captions']:
        subtitles = subtitle_text(words, clip)
        if subtitles:
            (output.parent / 'captions.srt').write_text(subtitles, encoding='utf-8')
            def color(value):
                return '&H00' + value[5:7] + value[3:5] + value[1:3]
            font = {'sans':'Arial','serif':'Times New Roman','mono':'Courier New'}.get(clip.get('font','sans'),'Arial')
            effect = clip.get('textEffect','box')
            border = 3 if effect == 'box' else 1
            outline = 1 if effect == 'box' else 0.7 if effect == 'outline' else 0
            shadow = 0.7 if effect == 'shadow' else 0
            bold = -1 if effect == 'bold' else 0
            style = f"FontName={font},Bold={bold},FontSize={float(clip['fontSize'])*288/height},PrimaryColour={color(clip['color'])},BackColour={color(clip['background'])},OutlineColour={color(clip['background'])},BorderStyle={border},Outline={outline},Shadow={shadow},Alignment=2,MarginV=23,MarginL=19,MarginR=19"
            filters += f",subtitles=captions.srt:force_style='{style}'"
    args = [os.getenv('FFMPEG', 'ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file,pipe', '-ss', str(clip['start']), '-i', str(source), '-t', str(clip['end']-clip['start']), '-map', '0:v:0', '-map', '0:a:0?', '-vf', filters, '-c:v', 'libx264', '-preset', preset or os.getenv('EXPORT_PRESET','veryfast'), '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(output)]
    if progress_file:
        args[1:1] = ['-progress', str(progress_file), '-nostats']
    subprocess.run(args, cwd=output.parent, capture_output=True, check=True, timeout=7200)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        fp.close()
        raise urllib.error.HTTPError(req.full_url, code, 'Redirect refused', headers, None)

def open_media(url, data=None):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Media URL must use HTTPS without credentials.')
    request = urllib.request.Request(url, data=data, method='PUT' if data is not None else 'GET')
    return urllib.request.build_opener(NoRedirect()).open(request, timeout=120)

class Client:
    def __init__(self, base, token, job=None):
        parsed = urllib.parse.urlsplit(base)
        if parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment or not (parsed.scheme == 'https' or (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1'))):
            raise ValueError('Worker URL must be an HTTPS origin or local development address.')
        self.base = base.rstrip('/')
        self.token = token
        self.job = copy.deepcopy(job)

    def request(self, path, payload=None, method='POST', binary=None):
        headers = {'Authorization': f'Bearer {self.token}'}
        if self.job:
            headers['X-Job-Token'] = self.job['token']
        if os.getenv('VERCEL_AUTOMATION_BYPASS_SECRET'):
            headers['x-vercel-protection-bypass'] = os.environ['VERCEL_AUTOMATION_BYPASS_SECRET']
        data = None
        if payload is not None:
            data = json.dumps(payload).encode()
            headers['Content-Type'] = 'application/json'
        elif binary is not None:
            data = binary
            headers['Content-Type'] = 'application/octet-stream'
        request = urllib.request.Request(self.base + '/api/worker/' + path, data=data, headers=headers, method=method)
        return urllib.request.build_opener(NoRedirect()).open(request, timeout=120)

    def json(self, path, payload=None, method='POST', binary=None):
        with self.request(path, payload, method, binary) as response:
            return json.load(response)
    def download_source(self, target):
        signed = self.json(f"jobs/{self.job['id']}/source", method='GET')
        total = 0
        with open_media(signed['url']) as response, target.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > 2 * 1024**3:
                    raise ValueError('Source exceeds 2 GB.')
                output.write(chunk)

    def upload_part(self, kind, number, chunk):
        signed = self.json(f"jobs/{self.job['id']}/{kind}-part/{number}", {'size': len(chunk)})
        with open_media(signed['url'], chunk) as response:
            etag = response.headers.get('ETag')
            if not etag:
                raise ValueError('Storage did not return an upload ETag.')
            return {'partNumber': number, 'etag': etag}


def process(client, job):
    global MODEL
    client = Client(client.base, client.token, job)
    stop = threading.Event()
    render_progress = [None]
    state = {'stage': ('downloading' if job['payload'].get('youtube') else 'transcribing') if job['kind'] == 'transcribe' else 'rendering', 'progress': 5}
    def heartbeat():
        while not stop.is_set():
            try:
                if render_progress[0] and render_progress[0].exists():
                    values = re.findall(r'out_time_us=(\d+)', render_progress[0].read_text())
                    if values:
                        length = job['payload']['clip']['end'] - job['payload']['clip']['start']
                        state['progress'] = min(89, 5 + int(int(values[-1]) / 1000000 / length * 84))
                client.json(f"jobs/{job['id']}/heartbeat", state)
            except Exception:
                pass
            stop.wait(3 if job['kind'] == 'export' else 20)
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix='loofy-') as directory:
            temp = pathlib.Path(directory)
            source = temp / 'source.mp4'
            if job['kind'] == 'transcribe' and job['payload'].get('youtube'):
                from yt_dlp import YoutubeDL
                class Quiet:
                    def debug(self, message): pass
                    def warning(self, message): pass
                    def error(self, message): pass
                download_started = time.monotonic()
                def limit(progress):
                    if time.monotonic() - download_started > 900:
                        raise ValueError('YouTube download timed out. Retry or upload the original file.')
                    if progress.get('downloaded_bytes', 0) > 2*1024**3:
                        raise ValueError('The YouTube source exceeds 2 GB. Upload a smaller original video.')
                options = {'quiet': True, 'logger': Quiet(), 'noplaylist': True, 'socket_timeout': 30, 'retries': 2,
                           'format': 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=1080][vcodec^=avc1][ext=mp4]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]',
                           'outtmpl': str(source), 'merge_output_format': 'mp4', 'max_filesize': 2*1024**3,
                           'js_runtimes': {'node': {}}, 'progress_hooks': [limit]}
                try:
                    with YoutubeDL(options) as downloader:
                        info = downloader.extract_info(job['payload']['youtube'], download=False)
                        length = info.get('duration')
                        if info.get('is_live') or not length or length > 3600:
                            raise ValueError('Use a finished YouTube video no longer than 60 minutes.')
                        job['projectData']['duration'] = length
                        client.json(f"jobs/{job['id']}/import-prepare", {'duration': length, 'name': info.get('title', 'YouTube video')})
                        job['projectData']['duration'] = length
                        downloader.download([job['payload']['youtube']])
                    if not source.exists() or source.stat().st_size > 2*1024**3:
                        raise ValueError('The video could not be downloaded within the 2 GB limit. Upload the original file.')
                    prepare_browser_source(source)
                    parts = []
                    with source.open('rb') as stream:
                        while chunk := stream.read(PART_SIZE):
                            parts.append(client.upload_part('import', len(parts)+1, chunk))
                    client.json(f"jobs/{job['id']}/import-complete", {'parts': parts})
                except urllib.error.HTTPError as exc:
                    if exc.code == 402:
                        raise ValueError('Not enough credits for this video. Add credits and retry.') from exc
                    raise
                except ValueError:
                    raise
                except Exception as exc:
                    raise ValueError('YouTube could not provide this video. It may be restricted or unavailable. Retry or upload the original file.') from exc
            else:
                client.download_source(source)
            state['stage'] = 'transcribing' if job['kind'] == 'transcribe' else 'rendering'
            duration, has_audio = probe(source)
            if duration > job['projectData']['duration'] + 1:
                raise ValueError('The source duration differs from its upload metadata. Upload the original file again.')
            if job['kind'] == 'transcribe':
                language = job['projectData']['language']
                words = []
                if has_audio:
                    from faster_whisper import WhisperModel
                    if MODEL is None:
                        MODEL = WhisperModel(os.getenv('WHISPER_MODEL', 'base'), device=os.getenv('WHISPER_DEVICE', 'cpu'), compute_type=os.getenv('WHISPER_COMPUTE', 'int8'), download_root=os.getenv('WHISPER_CACHE'))
                    segments, info = MODEL.transcribe(str(source), language=None if language == 'auto' else language, word_timestamps=True, vad_filter=True, beam_size=5)
                    language = info.language
                    if language not in ('en', 'id'):
                        raise ValueError('This beta supports English and Indonesian. Upload a supported video or select its language manually.')
                    for segment in segments:
                        for word in segment.words or []:
                            words.append({'start': max(0, word.start), 'end': min(duration, word.end), 'text': word.word.strip()})
                        state['progress'] = min(85, int(segment.end/duration*85))
                state.update(stage='finding highlights', progress=90)
                client.json(f"jobs/{job['id']}/heartbeat", state)
                client.json(f"jobs/{job['id']}/finish", {'duration': duration, 'language': 'en' if language == 'auto' else language, 'words': words})
            else:
                output = temp / 'clip.mp4'
                render_progress[0] = temp / 'render-progress.txt'
                render(source, output, job['payload']['clip'], job['payload']['words'], progress_file=render_progress[0])
                render_progress[0] = None
                state['progress'] = 90
                if output.stat().st_size > 1024**3:
                    raise ValueError('This export exceeds 1 GB. Choose a shorter clip and retry.')
                upload = client.json(f"jobs/{job['id']}/output-start")
                parts = []
                with output.open('rb') as stream:
                    while chunk := stream.read(PART_SIZE):
                        part = client.upload_part('output', len(parts)+1, chunk)
                        parts.append(part)
                client.json(f"jobs/{job['id']}/output-complete", {'parts': parts})
                client.json(f"jobs/{job['id']}/finish", {})
    except Exception as exc:
        message = str(exc) if isinstance(exc, ValueError) else 'The video could not be processed. Check that the source plays correctly and retry.'
        try:
            client.json(f"jobs/{job['id']}/finish", {'error': message})
        except Exception:
            pass  # A lost lease is recovered durably by the next claim.
        print(f"Job {job['id']} failed ({type(exc).__name__}).", flush=True)
    finally:
        stop.set()
        thread.join(timeout=5)
        client.job = None

def main():
    config = pathlib.Path(__file__).with_name('.env')
    if config.exists():
        for line in config.read_text(encoding='utf-8-sig').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    url, token = os.getenv('LOOFY_URL'), os.getenv('PROCESSOR_TOKEN')
    if not url or not token:
        raise SystemExit('Set LOOFY_URL and PROCESSOR_TOKEN before starting the worker.')
    client = Client(url, token)
    while True:
        try:
            result = client.json('claim')
            if result['job']:
                process(client, result['job'])
            elif args.once:
                return
            else:
                time.sleep(30)
        except (urllib.error.URLError, TimeoutError):
            if args.once:
                raise
            time.sleep(10)
        if args.once:
            return

if __name__ == '__main__':
    main()
