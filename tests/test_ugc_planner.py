import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'processor'))
from ugc_planner import generate_plan, ROLES

class PlannerContract(unittest.TestCase):
    def test_local_request_grounding_and_named_scene_order(self):
        brief={'facts':'Ringkas. Untuk jenggot!','language':'id','cta':'Lihat detail','audience':'Pelancong','product':'Shaver'}
        raw={'concept':'Travel','palette':'cyan',**{role:{'evidence':'Ringkas','displayText':role,'narration':' '.join(['kata']*12),'motion':'push','transition':'fade'} for role in ROLES}}
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,limit):return json.dumps({'message':{'content':json.dumps(raw)}}).encode()
        def request(req,timeout):
            self.assertEqual(req.full_url,'http://127.0.0.1:11434/api/chat')
            payload=json.loads(req.data)
            self.assertEqual(payload['options']['num_gpu'],0)
            self.assertFalse(payload['think'])
            for role in ROLES:self.assertEqual(payload['format']['properties'][role]['properties']['evidence']['enum'],['Ringkas','Untuk jenggot'])
            return Response()
        with patch('ugc_planner.urllib.request.urlopen',side_effect=request):result=generate_plan(brief)
        self.assertEqual([s['layout'] for s in result['scenes']],list(ROLES))
        self.assertTrue(all(s['seconds']==6 for s in result['scenes']))
        self.assertEqual(result['hook'],'hero')
        self.assertEqual(result['cta'],'cta')

if __name__=='__main__':unittest.main()
