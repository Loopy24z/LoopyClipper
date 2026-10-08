"""CPU-only photo/storyboard renderer. No model API, Docker, or speech synthesis."""
import base64
import json
import os
import pathlib
import subprocess
import textwrap

def run(args, cwd, timeout=600):
    try:
        subprocess.run([os.getenv('FFMPEG','ffmpeg'),'-hide_banner','-loglevel','error','-y',*args],cwd=cwd,check=True,timeout=timeout,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    except subprocess.TimeoutExpired as exc:
        raise ValueError('Rendering took too long. Use fewer or shorter scenes and retry.') from exc
    except subprocess.CalledProcessError as exc:
        raise ValueError('The image or MP3 could not be rendered. Try a different JPEG reference or MP3 recording.') from exc

def render_product(data, output, progress=None):
    from worker import dimensions, ass_subtitles, clean_text
    folder=pathlib.Path(output).parent
    if not data.get('rights') or data.get('mode')!='product':raise ValueError('Product image permission is required.')
    image=data.get('image','')
    if not image.startswith('data:image/jpeg;base64,') or len(image)>220000:raise ValueError('Add a valid product image.')
    (folder/'reference.jpg').write_bytes(base64.b64decode(image.split(',',1)[1],validate=True))
    info=json.loads(subprocess.check_output([os.getenv('FFPROBE','ffprobe'),'-v','error','-protocol_whitelist','file,pipe','-show_streams','-of','json',str(folder/'reference.jpg')]))
    v=info['streams'][0]
    if v.get('codec_name')!='mjpeg' or v.get('width',0)*v.get('height',0)>16777216:raise ValueError('Use a JPEG image smaller than 16 megapixels.')
    scenes=data.get('scenes',[])
    if not 1<=len(scenes)<=8 or any(not isinstance(s.get('seconds'),int) or not 1<=s['seconds']<=15 for s in scenes):raise ValueError('Use one to eight scenes, each 1 to 15 seconds.')
    total=sum(s['seconds'] for s in scenes)
    if total>60:raise ValueError('Keep the video within 60 seconds.')
    width,height=dimensions(data['ratio']);fps=24;words=[];scene_words=[];offset=0;display_events=[]
    layouts=json.loads((pathlib.Path(__file__).resolve().parents[1]/'lib'/'ugc-layouts.json').read_text(encoding='utf-8-sig'))
    palette={'violet':('0x151126','0xa78bfa'),'cyan':('0x071d28','0x22d3ee'),'amber':('0x251a0b','0xfbbf24')}.get(data.get('palette','violet'))
    if not palette:raise ValueError('Unsupported palette.')
    def stamp(t):
        ticks=round(t*100);return f'{ticks//360000}:{ticks//6000%60:02}:{ticks//100%60:02}.{ticks%100:02}'

    for index,scene in enumerate(scenes):
        seconds=scene['seconds'];frames=seconds*fps
        # Fit the entire product over a blurred background; alternating gentle push/pull.
        motion=scene.get('motion','auto')
        if motion not in ('auto','still','push','pull') or scene.get('transition','fade') not in ('fade','cut'):raise ValueError('Unsupported scene effect.')
        strength=.12 if scene.get('intensity')=='dynamic' else .035
        zoom='1' if motion=='still' else f'1+{strength}*on/{frames}' if motion=='push' or motion=='auto' and index%2==0 else f'{1+strength}-{strength}*on/{frames}'
        fade=f'fade=t=in:st=0:d=0.15,fade=t=out:st={seconds-0.15}:d=0.15,' if scene.get('transition','fade')=='fade' else ''
        framing=scene.get('framing','fit')
        if framing not in ('fit','cover') or scene.get('intensity','gentle') not in ('gentle','dynamic'):raise ValueError('Unsupported framing.')
        foreground=f'scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}' if framing=='cover' else f'scale={width}:{height}:force_original_aspect_ratio=decrease'
        vf=f"[0:v]split=2[bg][fg];[bg]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},boxblur=20:2[blur];[fg]{foreground}[fit];[blur][fit]overlay=(W-w)/2:(H-h)/2,zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={frames}:s={width}x{height}:fps={fps},{fade}setsar=1,format=yuv420p[out]"
        layout=scene.get('layout','full')
        if layout!='full':
            if layout not in layouts:raise ValueError('Unsupported composition layout.')
            design=layouts[layout];x,y,pw,ph=[round(v*(width if i%2==0 else height)/2)*2 for i,v in enumerate(design['image'])]
            bg,accent=palette
            vf=f"[0:v]scale={pw}:{ph}:force_original_aspect_ratio=decrease,pad={pw}:{ph}:(ow-iw)/2:(oh-ih)/2:color={bg},zoompan=z='{zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={frames}:s={pw}x{ph}:fps={fps}[product];color=c={bg}:s={width}x{height}:r={fps}:d={seconds},drawbox=x={round(width*.08)}:y={round(height*.04)}:w={round(width*.18)}:h={max(4,round(height*.005))}:color={accent}:t=fill,drawbox=x={x-4}:y={y-4}:w={pw+8}:h={ph+8}:color={accent}:t=3[stage];[stage][product]overlay={x}:{y}:shortest=1,{fade}setsar=1,format=yuv420p[out]"
            text=clean_text(scene.get('displayText',''))
            lines='\\N'.join(textwrap.wrap(text,width=25 if width<=height else 40))
            tx=round(width*design['text'][0]);ty=round(height*design['text'][1]);size=round(min(width,height)*design['size'])
            tag=f"{{\\an8\\move({tx},{ty+20},{tx},{ty},0,250)\\fs{size}\\b1\\bord0\\shad0\\fad(120,120)}}"
            display_events.append(f'Dialogue: 1,{stamp(offset)},{stamp(offset+seconds)},Default,,0,0,0,,{tag}{lines}')
        run(['-threads','2','-protocol_whitelist','file,pipe','-i','reference.jpg','-filter_complex_threads','1','-filter_complex',vf,'-map','[out]','-frames:v',str(frames),'-an','-c:v','libx264','-preset','veryfast','-crf','22','-threads','2',f'scene-{index}.mp4'],folder)
        text=scene.get('narration','').strip().split();scene_start=len(words)
        for n,word in enumerate(text):words.append({'text':word,'start':offset+n*seconds/len(text),'end':offset+(n+1)*seconds/len(text)})
        scene_words.append(words[scene_start:])
        offset+=seconds
        if progress:progress(int((index+1)/len(scenes)*75))
    (folder/'scenes.txt').write_text(''.join(f"file 'scene-{i}.mp4'\n" for i in range(len(scenes))),encoding='utf8')
    run(['-f','concat','-safe','1','-i','scenes.txt','-c','copy','joined.mp4'],folder)
    clip={'start':0,'end':total,'ratio':data['ratio'],'captions':data.get('captionStyle')!='none','fontSize':data.get('captionSize',44),'font':'sans','color':'#ffffff','background':'#000000','textEffect':data.get('captionStyle','outline'),'captionPosition':data.get('captionPosition','bottom'),'wordsPerCaption':5,'captionPhrases':False,'headlineEnabled':False}
    captions=ass_subtitles([],clip)+''.join(line+'\n' for group in scene_words for line in ass_subtitles(group,clip).splitlines() if line.startswith('Dialogue:'))
    (folder/'captions.ass').write_text(captions+'\n'.join(display_events)+'\n',encoding='utf8')
    args=['-i','joined.mp4'];audio=[]
    for key in ('voice','music'):
        if data.get(key):
            if len(data[key])>1400000:raise ValueError('Audio exceeds the size limit.')
            raw=base64.b64decode(data[key].split(',',1)[1],validate=True)
            (folder/(key+'.mp3')).write_bytes(raw)
            args+=['-protocol_whitelist','file,pipe','-f','mp3','-i',key+'.mp3'];audio.append(key)
    preset=data.get('musicPreset','none')
    if preset not in ('none','pulse','calm'):raise ValueError('Unsupported music preset.')
    if not data.get('music') and preset!='none':
        track=pathlib.Path(__file__).resolve().parents[1]/'public'/'audio'/(preset+'.wav')
        if not track.is_file():raise ValueError('Built-in music is missing. Update the Windows worker files.')
        args+=['-stream_loop','-1','-i',str(track)];audio.append('music')
    if not audio:args+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo'];audio=['silence']
    filters=[]
    for i,key in enumerate(audio,1):filters.append(f'[{i}:a]aresample=48000,volume={0.18 if key=="music" and "voice" in audio else 0.55 if key=="music" else 1},apad,atrim=0:{total},afade=t=out:st={max(0,total-.4)}:d=0.4[a{i}]')
    if len(audio)==2:filters.append('[a1][a2]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]')
    else:filters.append('[a1]alimiter=limit=0.95[aout]')
    args+=['-filter_complex_threads','1','-filter_complex',';'.join(filters),'-map','0:v','-map','[aout]','-vf','ass=captions.ass','-t',str(total),'-c:v','libx264','-preset','veryfast','-crf','22','-threads','2','-c:a','aac','-b:a','128k','-pix_fmt','yuv420p','-movflags','+faststart',str(output)]
    run(args,folder)
    if pathlib.Path(output).stat().st_size>128*1024**2:raise ValueError('Output is too large. Shorten the storyboard.')
    if progress:progress(90)
    return total
