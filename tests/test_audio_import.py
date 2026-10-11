import importlib.util, json, pathlib, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('audio_import',pathlib.Path(__file__).parents[1]/'processor/audio_import.py')
audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)

class AudioImportTests(unittest.TestCase):
 def test_download_rejects_non_platform_before_network(self):
  with self.assertRaises(ValueError):audio.download('https://localhost/private',pathlib.Path('.'))
 def test_worker_encodes_then_uploads_and_finishes(self):
  class Client:
   def __init__(self):self.calls=[]
   def json(self,path,payload):
    self.calls.append((path,payload))
    return {'url':'https://storage.example/audio'} if path.endswith('/upload') else {'ok':True}
  class Child:
   def __init__(self,args,**kwargs):
    folder=pathlib.Path(args[-1]);(folder/'source.wav').write_bytes(b'fixture');(folder/'title.json').write_text(json.dumps({'name':'Fixture'}))
   def wait(self,timeout=None):return 0
   def poll(self):return 0
  def ffmpeg(args,**kwargs):pathlib.Path(args[-1]).write_bytes(b'encoded-mp3')
  class Response:
   status=200
   def __enter__(self):return self
   def __exit__(self,*args):pass
  client=Client()
  with patch.object(audio.subprocess,'Popen',Child),patch.object(audio.subprocess,'run',ffmpeg),patch.object(audio.urllib.request,'urlopen',return_value=Response()):
   audio.process_audio_import(client,{'id':'job','token':'lease','url':'https://youtu.be/fixture'})
  self.assertEqual(client.calls[-1][0],'audio-import/finish')
  self.assertEqual(client.calls[-1][1]['name'],'Fixture')
  self.assertTrue(all(payload['token']=='lease' for _,payload in client.calls))
 def test_download_rejects_playlist_before_fetching_media(self):
  class Downloader:
   def __init__(self,options):pass
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def extract_info(self,*args,**kwargs):return {'_type':'playlist','entries':[]}
  with tempfile.TemporaryDirectory() as folder,patch('yt_dlp.YoutubeDL',Downloader):
   with self.assertRaisesRegex(ValueError,'limit'):audio.download('https://youtu.be/fixture',pathlib.Path(folder))
if __name__=='__main__':unittest.main()
