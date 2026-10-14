import pathlib
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'processor'))
import worker
import audio_import
import publishing


class AudioLaneTest(unittest.TestCase):
    def test_audio_finishes_while_video_job_is_blocked(self):
        video_started, audio_finished = threading.Event(), threading.Event()
        clients = []

        class Client:
            def __init__(self, *args):
                self.claimed = False
                clients.append(self)

            def json(self, path, *args):
                if path == 'audio-import/claim':
                    if self.claimed:
                        return {'job': None}
                    self.claimed = True
                    return {'job': {'id': 'audio'}}
                return {'job': {'id': 'video'} if path == 'claim' else None}

        def audio(client, job):
            if video_started.wait(3):
                audio_finished.set()

        def video(client, job):
            video_started.set()
            self.assertTrue(audio_finished.wait(3), 'Audio must run before the video job finishes')
            self.assertIs(client, clients[0])
            raise KeyboardInterrupt()

        with patch.dict(worker.os.environ, {'LOOFY_URL': 'https://example.com', 'PROCESSOR_TOKEN': 'fixture'}), patch.object(worker.pathlib.Path, 'exists', return_value=False), patch.object(sys, 'argv', ['worker.py']), patch.object(worker, 'Client', Client), patch.object(worker, 'process', video), patch.object(audio_import, 'process_audio_import', audio), patch.object(publishing, 'Publisher'):
            with self.assertRaises(KeyboardInterrupt):
                worker.main()
        self.assertEqual(len(clients), 2, 'Audio must have its own credential context')


if __name__ == '__main__':
    unittest.main()
