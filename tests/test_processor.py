import importlib.util
import pathlib
import unittest
spec=importlib.util.spec_from_file_location('processor',pathlib.Path(__file__).parents[1]/'processor'/'worker.py')
processor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)

class ProcessorTests(unittest.TestCase):
 def test_subtitles_clip_and_escape_text(self):
  words=[{'start':9,'end':10.4,'text':'before'},{'start':10.4,'end':11,'text':'<hello>'},{'start':11,'end':12,'text':'world'},{'start':13,'end':14,'text':'after'}]
  clip={'start':10,'end':12,'captionText':None}
  result=processor.subtitle_text(words,clip)
  self.assertIn('00:00:00,000 --> 00:00:02,000',result)
  self.assertNotIn('<hello>',result)
  self.assertNotIn('after',result)
 def test_frame_dimensions(self):
  self.assertEqual(processor.dimensions('9:16'),(1080,1920))
  self.assertEqual(processor.dimensions('1:1'),(1080,1080))
  self.assertEqual(processor.dimensions('16:9'),(1920,1080))
  with self.assertRaises(ValueError):processor.dimensions('4:3')
if __name__=='__main__':unittest.main()
