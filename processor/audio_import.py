"""Bounded public social-audio import for the local processor."""
import json, pathlib, subprocess, sys, tempfile, time, urllib.request, urllib.error


def poll_imports(client, stop, interval=5):
    """One dedicated audio lane; never share the video client's job token."""
    while not stop.is_set():
        try:
            job = client.json('audio-import/claim', {}).get('job')
            if job:
                process_audio_import(client, job)
                continue
        except Exception as exc:
            # Keep credentials, source URLs and download responses out of logs.
            print(f'Audio queue temporarily unavailable ({type(exc).__name__}).', flush=True)
        if stop.wait(interval):
            return


def download(url, folder):
    from yt_dlp import YoutubeDL
    from urllib.parse import urlsplit
    host = (urlsplit(url).hostname or '').lower()
    sites = ('youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch', 'x.com', 'twitter.com', 'soundcloud.com')
    if urlsplit(url).scheme != 'https' or not any(host == h or host.endswith('.'+h) for h in sites):
        raise ValueError('unsupported')
    def progress(info):
        if info.get('downloaded_bytes', 0) > 100*1024**2:
            raise ValueError('limit')
    options = {'format':'bestaudio/best', 'noplaylist':True, 'quiet':True, 'no_warnings':True,
               'outtmpl':str(folder/'source.%(ext)s'), 'max_filesize':100*1024**2,
               'socket_timeout':20, 'retries':1, 'fragment_retries':1,
               'allowed_extractors':['youtube.*','tiktok.*','instagram.*','facebook.*','twitter.*','soundcloud.*'],
               'progress_hooks':[progress], 'js_runtimes':{'node':{}}}
    with YoutubeDL(options) as downloader:
        info = downloader.extract_info(url, download=False)
        duration = info.get('duration')
        if info.get('_type') in ('playlist','multi_video') or info.get('entries') is not None or info.get('is_live') or not isinstance(duration,(int,float)) or not 0 < duration <= 1200:
            raise ValueError('limit')
        downloader.process_info(info)
        (folder/'title.json').write_text(json.dumps({'name':info.get('title','Imported audio')}),encoding='utf-8')


def process_audio_import(client, job):
    payload={'id':job['id'],'token':job['token']}
    def call(action, **extra):
        return client.json('audio-import/'+action,{**payload,**extra})
    try:
        with tempfile.TemporaryDirectory(prefix='loofy-audio-') as directory:
            folder=pathlib.Path(directory)
            with (folder/'download.log').open('wb') as log:
                child=subprocess.Popen([sys.executable,str(pathlib.Path(__file__).resolve()),job['url'],str(folder)],stdout=log,stderr=log)
                started=time.monotonic()
                try:
                    while True:
                        try:
                            code=child.wait(timeout=20)
                            break
                        except subprocess.TimeoutExpired:
                            call('heartbeat')
                            if time.monotonic()-started>240:
                                raise TimeoutError()
                finally:
                    if child.poll() is None:
                        child.kill();child.wait()
            if code:
                message=(folder/'download.log').read_text(errors='replace')
                call('fail',error='limit' if "ValueError: limit" in message else 'unavailable')
                return
            sources=[p for p in folder.glob('source.*') if p.suffix not in ('.part','.ytdl')]
            if len(sources)!=1 or sources[0].stat().st_size>100*1024**2:
                call('fail',error='limit');return
            target=folder/'audio.mp3'
            call('heartbeat')
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(sources[0]),'-vn','-t','1200','-ac','2','-ar','44100','-c:a','libmp3lame','-b:a','128k',str(target)],check=True,timeout=90,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            size=target.stat().st_size
            if not 0<size<=25*1024**2:
                call('fail',error='limit');return
            signed=call('upload',size=size)
            request=urllib.request.Request(signed['url'],data=target.read_bytes(),method='PUT',headers={'Content-Type':'audio/mpeg'})
            with urllib.request.urlopen(request,timeout=90) as response:
                if response.status not in (200,201):raise ValueError('upload')
            call('finish',**json.loads((folder/'title.json').read_text(encoding='utf-8')))
            print(f'Audio import completed in {time.monotonic()-started:.1f}s.', flush=True)
    except (TimeoutError,subprocess.TimeoutExpired):
        call('fail',error='timeout')
    except Exception:
        # A cancelled lease returns 409: never restore or publish a cancelled job.
        try:call('fail',error='unavailable')
        except Exception:pass

if __name__=='__main__':
    download(sys.argv[1],pathlib.Path(sys.argv[2]))
