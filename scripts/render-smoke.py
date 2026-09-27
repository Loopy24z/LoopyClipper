import importlib.util, pathlib, subprocess, json
root=pathlib.Path.cwd()
spec=importlib.util.spec_from_file_location('worker',root/'processor/worker.py');worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
folder=root/'work'/'render-smoke';folder.mkdir(parents=True,exist_ok=True)
source=folder/'source.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(source)],check=True)
for i,ratio in enumerate(['9:16','1:1','16:9']):
 output=folder/f'clip-{i}.mp4'
 worker.render(source,output,{'ratio':ratio,'position':50,'fit':'contain','captions':True,'start':0,'end':1,'font':'sans','textEffect':'outline','fontSize':36,'color':'#ffffff','background':'#000000'},[{'start':0,'end':0.9,'text':'Test caption'}],preset='ultrafast')
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(output)]))
 video=next(s for s in data['streams'] if s['codec_type']=='video');audio=next(s for s in data['streams'] if s['codec_type']=='audio')
 assert (video['width'],video['height'])==worker.dimensions(ratio)
 assert video['codec_name']=='h264' and audio['codec_name']=='aac'
 print(ratio,video['width'],video['height'],video['codec_name'],audio['codec_name'],'OK')
