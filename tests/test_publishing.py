import pathlib, sys, tempfile, unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]/'processor'))
import publishing

class PublishingTests(unittest.TestCase):
 def test_rejects_credentials_to_nonprovider_upload_addresses(self):
  for url in ['http://www.googleapis.com/x','https://evil.test/x','https://user@graph.facebook.com/x','https://graph.facebook.com:444/x']:
   with self.assertRaises(ValueError):publishing.safe_provider_url(url)
 def test_youtube_upload_uses_reviewed_privacy_and_confirms_remote_id(self):
  calls=[];reports=[]
  def request(url,method='GET',body=None,headers=None,resume=False):
   calls.append((url,method,body,headers))
   return (200,{'Location':'https://www.googleapis.com/upload/test'}, {}) if method=='POST' else (200,{}, {'id':'video123'})
  with tempfile.TemporaryDirectory() as directory, patch.object(publishing,'request',request):
   path=pathlib.Path(directory)/'clip.mp4';path.write_bytes(b'export bytes')
   publishing.Publisher(None).youtube({'payload':{'title':'Title','description':'Description','privacy':'private','madeForKids':False,'synthetic':True}},'test-token',path,lambda action,**data:reports.append((action,data)))
  import json
  self.assertEqual(json.loads(calls[0][2])['status']['privacyStatus'],'private')
  self.assertEqual(calls[1][3]['Content-Range'],'bytes 0-11/12')
  self.assertIn(('checkpoint',{'remoteId':'video123'}),reports)
 def test_youtube_refuses_external_session_url(self):
  with tempfile.TemporaryDirectory() as directory, patch.object(publishing,'request',return_value=(200,{'Location':'https://evil.test'},{})):
   path=pathlib.Path(directory)/'clip.mp4';path.write_bytes(b'x')
   with self.assertRaises(ValueError):publishing.Publisher(None).youtube({'payload':{'title':'x','description':'','privacy':'private','madeForKids':False,'synthetic':False}},'secret',path,lambda *a,**k:None)
 def test_meta_wait_never_claims_success_on_pending_or_failed_response(self):
  with patch.object(publishing,'api',return_value={'status_code':'ERROR'}):
   with self.assertRaises(ValueError):publishing.Publisher(None).wait_meta('unused','secret',lambda d:d.get('status_code')=='FINISHED',lambda *a:None)

 def test_instagram_waits_for_container_before_publish(self):
  calls=[];reports=[]
  def api(url,token,data=None):
   calls.append((url,data))
   if url.endswith('/media'):return {'id':'container123'}
   if 'status_code' in url:return {'status_code':'FINISHED'}
   return {'id':'post456'}
  with patch.object(publishing,'graph',return_value='https://graph.facebook.com/v24.0'),patch.object(publishing,'api',api):
   publishing.Publisher(None).instagram({'account_id':'123','url':'https://storage.example/signed','payload':{'title':'Title','description':'Description'}},'secret',lambda a,**b:reports.append((a,b)))
  self.assertEqual(len(calls),3);self.assertIn('status_code',calls[1][0]);self.assertEqual(calls[2][1],{'creation_id':'container123'})
  self.assertEqual(reports[-1],('checkpoint',{'remoteId':'post456'}))
 def test_facebook_checks_processing_and_publishing_confirmation(self):
  calls=[]
  def api(url,token,data=None):
   calls.append((url,data))
   if data and data.get('upload_phase')=='start':return {'video_id':'123','upload_url':'https://rupload.facebook.com/video-upload/test/123'}
   if data:return {'success':True}
   return {'status':{'processing_phase':{'status':'complete'},'publishing_phase':{'status':'complete'}}}
  with patch.object(publishing,'graph',return_value='https://graph.facebook.com/v24.0'),patch.object(publishing,'api',api),patch.object(publishing,'request',return_value=(200,{}, {'success':True})):
   publishing.Publisher(None).facebook({'account_id':'123','url':'https://storage.example/signed','payload':{'title':'Title','description':'Description'}},'secret',lambda *a,**b:None)
  self.assertEqual(calls[2][1]['video_state'],'PUBLISHED');self.assertIsNone(calls[3][1])
