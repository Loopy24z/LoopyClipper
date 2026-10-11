import sys
import importlib.util
import pathlib
import unittest
import tempfile
import subprocess
import json
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]/'processor'))
spec=importlib.util.spec_from_file_location('processor',pathlib.Path(__file__).parents[1]/'processor'/'worker.py')
processor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)

class ProcessorTests(unittest.TestCase):
 def test_headline_independent_of_captions_and_clamped_to_output(self):
  clip={'start':0,'end':2,'ratio':'9:16','captions':False,'fontSize':40,'color':'#ffffff','background':'#000000','headlineEnabled':True,'headline':'Why {bad} \\test?','headlineDuration':3}
  result=processor.ass_subtitles([{'start':0,'end':1,'text':'HIDDEN'}],clip)
  self.assertNotIn('HIDDEN',result)
  self.assertIn('Dialogue: 1,0:00:00.00,0:00:02.00,Headline',result)
  self.assertNotIn('{bad}',result)
  self.assertIn('Why bad test?',result)
 def test_jump_cut_render_and_caption_timing(self):
  clip={'start':0,'end':3,'segments':[{'start':0,'end':1},{'start':2,'end':3}],'ratio':'9:16','fit':'cover','position':50,'captions':True,'fontSize':52,'color':'#ffffff','background':'#000000','textEffect':'highlight','font':'lato','wordsPerCaption':3,'headlineEnabled':True,'headline':'Opening headline','headlineDuration':1}
  words=[{'start':0,'end':.8,'text':'hello'},{'start':1.2,'end':1.8,'text':'REMOVED'},{'start':2,'end':2.9,'text':'next'}]
  captions=processor.subtitle_text(words,clip)
  self.assertNotIn('REMOVED',captions)
  self.assertIn('00:00:01,000 --> 00:00:01,900',captions)
  ass=processor.ass_subtitles(words,clip)
  self.assertIn('Lato',ass)
  self.assertIn('0:00:01.00,0:00:01.90',ass)
  with tempfile.TemporaryDirectory() as folder:
   source=pathlib.Path(folder)/'source.mp4'
   subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=s=160x90:r=30:d=3','-f','lavfi','-i','sine=duration=3','-c:v','libx264','-c:a','aac','-shortest',str(source)],check=True)
   for ratio in ['9:16','1:1','16:9']:
    clip['ratio']=ratio
    output=pathlib.Path(folder)/'clip.mp4'
    processor.render(source,output,clip,words,preset='ultrafast')
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]))
    self.assertAlmostEqual(float(data['format']['duration']),2,delta=.1)
    self.assertEqual((data['streams'][0]['width'],data['streams'][0]['height']),processor.dimensions(ratio))
    self.assertEqual([s['codec_name'] for s in data['streams']],['h264','aac'])
   # Nonzero trim and video-only sources use the same output timeline.
   silent=pathlib.Path(folder)/'silent.mp4'
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-an','-c:v','copy',str(silent)],check=True)
   clip.update(start=.5,segments=[{'start':.5,'end':1},{'start':2,'end':3}])
   processor.render(silent,output,clip,words,preset='ultrafast')
   self.assertAlmostEqual(processor.probe(output)[0],1.5,delta=.1)
 def test_invalid_segments_fail_closed(self):
  with self.assertRaises(ValueError):processor.clip_segments({'start':0,'end':4,'segments':[{'start':0,'end':3},{'start':2,'end':4}]})
 def test_browser_source_converts_incompatible_video_without_changing_duration(self):
  with tempfile.TemporaryDirectory() as folder:
   source=pathlib.Path(folder)/'source.mp4'
   subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=s=160x90:r=24:d=1','-f','lavfi','-i','sine=duration=1','-c:v','mpeg4','-c:a','aac','-shortest',str(source)],check=True)
   processor.prepare_browser_source(source)
   data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(source)]))
   self.assertEqual([s['codec_name'] for s in data['streams']],['h264','aac'])
   self.assertAlmostEqual(float(data['format']['duration']),1,delta=0.1)
   before=source.read_bytes()
   processor.prepare_browser_source(source)
   self.assertEqual(source.read_bytes(),before)
 def test_subtitles_clip_and_escape_text(self):
  words=[{'start':9,'end':10.4,'text':'before'},{'start':10.4,'end':11,'text':'<hello>'},{'start':11,'end':12,'text':'world'},{'start':13,'end':14,'text':'after'}]
  clip={'start':10,'end':12,'captionText':None}
  result=processor.subtitle_text(words,clip)
  self.assertIn('00:00:00,000 --> 00:00:02,000',result)
  self.assertNotIn('<hello>',result)
  self.assertNotIn('after',result)
 def test_modern_caption_animations_and_phrase_boundaries(self):
  words=[{'start':0,'end':.3,'text':'Hello,'},{'start':.4,'end':.7,'text':'new'},{'start':.8,'end':1.2,'text':'world.'}]
  clip={'start':0,'end':2,'ratio':'9:16','captions':True,'fontSize':52,'color':'#ffffff','background':'#000000','textEffect':'highlight'}
  self.assertEqual([[w['text'] for w in g] for g in processor.caption_groups(words,clip)],[['Hello,'],['new','world.']])
  for mode,tag in [('pop',r'\fscx88'),('rise',r'\move('),('reveal',r'\alpha&HFF&')]:
   result=processor.ass_subtitles(words,{**clip,'captionAnimation':mode})
   self.assertIn(tag,result)
   self.assertIn('world.',result)
  self.assertNotIn(r'\alpha&HFF&',processor.ass_subtitles(words,{**clip,'captionAnimation':'reveal','captionText':'Custom copy'}))
  with self.assertRaises(ValueError):processor.ass_subtitles(words,{**clip,'captionAnimation':'unsupported'})
 def test_frame_dimensions(self):
  self.assertEqual(processor.dimensions('9:16'),(1080,1920))
  self.assertEqual(processor.dimensions('1:1'),(1080,1080))
  self.assertEqual(processor.dimensions('16:9'),(1920,1080))
  with self.assertRaises(ValueError):processor.dimensions('4:3')
if __name__=='__main__':unittest.main()
