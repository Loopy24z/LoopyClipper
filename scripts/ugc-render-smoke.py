import pathlib,sys,subprocess,json,base64
sys.path.insert(0,str(pathlib.Path('processor').resolve()))
from ugc_render import render_product
root=pathlib.Path('work/ugc-render-smoke').resolve();root.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=640x640','-frames:v','1',str(root/'reference.jpg')],check=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','libmp3lame',str(root/'voice.mp3')],check=True)
image='data:image/jpeg;base64,'+base64.b64encode((root/'reference.jpg').read_bytes()).decode();audio='data:audio/mpeg;base64,'+base64.b64encode((root/'voice.mp3').read_bytes()).decode()
for ratio,shape in [('9:16',(1080,1920)),('1:1',(1080,1080)),('16:9',(1920,1080))]:
 folder=root/ratio.replace(':','-');folder.mkdir(exist_ok=True)
 data={'mode':'product','rights':True,'ratio':ratio,'image':image,'musicPreset':'pulse','captionStyle':'highlight','captionPosition':'top','scenes':[{'seconds':1,'framing':'cover','intensity':'dynamic','motion':'push','transition':'cut','narration':'Hello product'},{'seconds':1,'motion':'pull','transition':'fade','narration':'Produk berkualitas'}]}
 out=folder/'result.mp4';render_product(data,out)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(out)]));v=next(s for s in info['streams'] if s['codec_type']=='video');a=next(s for s in info['streams'] if s['codec_type']=='audio');assert(v['width'],v['height'])==shape;assert v['codec_name']=='h264' and a['codec_name']=='aac';assert abs(float(info['format']['duration'])-2)<.15
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','0.5','-i',str(out),'-frames:v','1',str(folder/'frame.png')],check=True)
 import array,math
 pcm=array.array('h',subprocess.check_output(['ffmpeg','-v','error','-i',str(out),'-vn','-f','s16le','-ac','1','-ar','16000','pipe:1']))
 rms=math.sqrt(sum(x*x for x in pcm)/len(pcm));assert rms>100, 'Export must contain audible music, not just an AAC track'
 print('Audio RMS',round(rms),flush=True)
 print('PASS',ratio,shape,'H264/AAC 2s',flush=True)
