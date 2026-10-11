import pathlib, sys, tempfile, subprocess, json, unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]/'processor'))
import worker
from motion import motion_scale

class MotionTests(unittest.TestCase):
 def test_actual_render_has_motion_keeps_audio_duration_and_dimensions(self):
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);source=root/'source.mp4'
   # Static grid makes a moving crop distinguishable from source-camera motion.
   subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=navy:s=320x180:r=30:d=6','-f','lavfi','-i','sine=duration=6','-vf','drawgrid=w=40:h=30:t=3:c=white','-c:v','libx264','-c:a','aac','-shortest',str(source)],check=True)
   clip={'start':0,'end':6,'segments':[{'start':0,'end':2},{'start':3,'end':6}],'ratio':'9:16','fit':'cover','position':50,'captions':False,'fontSize':52,'color':'#ffffff','background':'#000000','motionAmount':.16}
   for mode in ['opening','subtle','rhythm']:
    output=root/(mode+'.mp4');clip['motion']=mode
    with patch.object(worker,'dimensions',return_value=(180,320)):
     worker.render(source,output,clip,[],preset='ultrafast')
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]))
    self.assertLess(abs(float(info['format']['duration'])-5),.15)
    video=next(s for s in info['streams'] if s['codec_type']=='video')
    self.assertEqual((video['width'],video['height'],video['codec_name']),(180,320,'h264'))
    self.assertTrue(any(s['codec_name']=='aac' for s in info['streams']))
    frames=[]
    for at in [.2,4.2]:
     frames.append(subprocess.check_output(['ffmpeg','-v','error','-ss',str(at),'-i',str(output),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']))
    delta=sum(abs(a-b) for a,b in zip(*frames))/len(frames[0])
    self.assertGreater(delta,2,mode+' must visibly change a static frame')
 def test_shared_curve_landmarks(self):
  self.assertAlmostEqual(motion_scale('opening',0),1.1)
  self.assertEqual(motion_scale('opening',3),1)
  self.assertEqual(motion_scale('rhythm',3.99),1)
  self.assertAlmostEqual(motion_scale('rhythm',4),1.1)
  self.assertAlmostEqual(motion_scale('subtle',4),1.1)
