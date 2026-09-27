"""Exercise the urllib boundary without contacting cloud services."""
import importlib.util
import io
import json
import os
import pathlib
import tempfile
import unittest
import urllib.error
import urllib.request
from email.message import Message
from unittest.mock import patch
from urllib.response import addinfourl

spec = importlib.util.spec_from_file_location('worker', pathlib.Path(__file__).parents[1] / 'processor' / 'worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class Transport(urllib.request.BaseHandler):
    def __init__(self, routes):
        self.routes = routes
        self.seen = []

    def default_open(self, request):
        self.seen.append(request)
        route = self.routes.get((request.get_method(), request.full_url))
        if route is None:
            raise AssertionError(f'Unexpected request: {request.get_method()} {request.full_url}')
        status, body, headers = route
        message = Message()
        for name, value in headers.items():
            message[name] = value
        response = addinfourl(io.BytesIO(body), message, request.full_url, status)
        response.msg = 'test response'
        return response


class WorkerTransportTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'VERCEL_AUTOMATION_BYPASS_SECRET': 'preview-test-secret', 'SITES_BYPASS_TOKEN': 'obsolete'}, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)

    def transport(self, routes):
        transport = Transport(routes)
        real_build = urllib.request.build_opener
        self.enterContext(patch.object(urllib.request, 'build_opener', side_effect=lambda *handlers: real_build(transport, *handlers)))
        # The old implementation uses the default opener; exercise it too.
        self.enterContext(patch.object(urllib.request, 'urlopen', side_effect=real_build(transport).open))
        return transport

    def test_control_plane_redirect_cannot_send_secrets_to_media_host(self):
        transport = self.transport({
            ('POST', 'https://loofy.example/api/worker/claim'): (302, b'', {'Location': 'https://media.example/stolen'}),
            ('GET', 'https://media.example/stolen'): (200, b'{}', {}),
        })
        with self.assertRaises(urllib.error.HTTPError):
            worker.Client('https://loofy.example', 'processor-test-token').json('claim')
        self.assertEqual(len(transport.seen), 1)

    def test_job_token_is_a_snapshot_and_vercel_secret_stays_on_api_origin(self):
        transport = self.transport({('POST', 'https://loofy.example/api/worker/jobs/job-a/heartbeat'): (200, b'{}', {})})
        job = {'id': 'job-a', 'token': 'lease-a', 'payload': {}}
        client = worker.Client('https://loofy.example', 'processor-test-token', job)
        job['token'] = 'lease-b'
        client.json('jobs/job-a/heartbeat', {'progress': 5})
        headers = dict((k.lower(), v) for k, v in transport.seen[0].header_items())
        self.assertEqual(headers['x-job-token'], 'lease-a')
        self.assertEqual(headers['x-vercel-protection-bypass'], 'preview-test-secret')
        self.assertNotIn('oai-sites-authorization', headers)

    def test_signed_source_download_has_no_application_secrets(self):
        transport = self.transport({
            ('GET', 'https://loofy.example/api/worker/jobs/job-a/source'): (200, b'{"url":"https://media.example/source?signature=test"}', {}),
            ('GET', 'https://media.example/source?signature=test'): (200, b'video-bytes', {}),
        })
        with tempfile.TemporaryDirectory(dir=pathlib.Path(__file__).parents[1] / 'work') as folder:
            target = pathlib.Path(folder) / 'source.mp4'
            worker.Client('https://loofy.example', 'processor-test-token', {'id': 'job-a', 'token': 'lease-a'}).download_source(target)
            self.assertEqual(target.read_bytes(), b'video-bytes')
        headers = dict((k.lower(), v) for k, v in transport.seen[-1].header_items())
        for name in ('authorization', 'x-job-token', 'x-vercel-protection-bypass', 'oai-sites-authorization'):
            self.assertNotIn(name, headers)

    def test_signed_upload_puts_bytes_directly_and_collects_etag(self):
        transport = self.transport({
            ('POST', 'https://loofy.example/api/worker/jobs/job-a/output-part/1'): (200, b'{"url":"https://media.example/part?signature=test","partNumber":1}', {}),
            ('PUT', 'https://media.example/part?signature=test'): (200, b'', {'ETag': '"part-etag"'}),
        })
        client = worker.Client('https://loofy.example', 'processor-test-token', {'id': 'job-a', 'token': 'lease-a'})
        result = client.upload_part('output', 1, b'clip-bytes')
        self.assertEqual(result, {'partNumber': 1, 'etag': '"part-etag"'})
        self.assertEqual(json.loads(transport.seen[0].data), {'size': 10})
        self.assertEqual(transport.seen[1].data, b'clip-bytes')
        headers = dict((k.lower(), v) for k, v in transport.seen[1].header_items())
        for name in ('authorization', 'x-job-token', 'x-vercel-protection-bypass'):
            self.assertNotIn(name, headers)

    def test_unsafe_media_url_is_rejected_before_network_access(self):
        for url in ('http://remote.example/video', 'file:///etc/passwd', 'https://user:secret@example.com/video'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                worker.open_media(url)


if __name__ == '__main__':
    unittest.main()
