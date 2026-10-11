"""Owner-only social connectors. Credentials stay in processor/.env, never in the UI or jobs.
No automatic re-delivery after an external request has started: uncertain jobs require review.
"""
import json
import os
import pathlib
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

HOSTS = {'www.googleapis.com', 'oauth2.googleapis.com', 'graph.facebook.com', 'rupload.facebook.com'}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        fp.close()
        raise ValueError('Provider redirect refused.')

def safe_provider_url(url):
    u = urllib.parse.urlsplit(url)
    if u.scheme != 'https' or u.hostname not in HOSTS or u.username or u.password or u.port not in (None,443):
        raise ValueError('Unexpected provider upload address.')
    return url

def request(url, method='GET', body=None, headers=None, resume=False):
    safe_provider_url(url)
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        response = urllib.request.build_opener(NoRedirect()).open(req, timeout=90)
    except urllib.error.HTTPError as e:
        if resume and e.code == 308:
            response = e
        else:
            raise ValueError('Provider rejected the request. Check permissions, token expiry and account requirements.') from None
    with response:
        raw = response.read(2*1024*1024)
        return response.status, dict(response.headers), json.loads(raw) if raw else {}

def api(url, token, data=None):
    status, headers, result = request(url, 'POST' if data is not None else 'GET', json.dumps(data).encode() if data is not None else None,
        {'Authorization':'Bearer '+token, 'Content-Type':'application/json'})
    if result.get('error'): raise ValueError('Provider returned an error.')
    return result

def google_token():
    fields = {k:os.environ['PUBLISH_YOUTUBE_'+env] for k,env in [('client_id','CLIENT_ID'),('client_secret','CLIENT_SECRET'),('refresh_token','REFRESH_TOKEN')]}
    fields['grant_type']='refresh_token'
    _,_,data=request('https://oauth2.googleapis.com/token','POST',urllib.parse.urlencode(fields).encode(),{'Content-Type':'application/x-www-form-urlencoded'})
    return data['access_token']

def graph():
    # Pin an explicitly configured supported Graph version; never silently adopt a new contract.
    version=os.getenv('PUBLISH_META_VERSION','')
    import re
    if not re.fullmatch(r'v[0-9]{2}\.0',version): raise ValueError('Set PUBLISH_META_VERSION to a supported Graph API version.')
    return 'https://graph.facebook.com/'+version

def configured(platform):
    names={'youtube':['CLIENT_ID','CLIENT_SECRET','REFRESH_TOKEN','CHANNEL_ID'], 'facebook':['PAGE_ID','TOKEN'], 'instagram':['ACCOUNT_ID','TOKEN']}[platform]
    return all(os.getenv('PUBLISH_'+platform.upper()+'_'+name) for name in names) and (platform=='youtube' or bool(os.getenv('PUBLISH_META_VERSION')))

def identity(platform):
    if platform=='youtube':
        token=google_token()
        items=api('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',token).get('items',[])
        expected=os.environ['PUBLISH_YOUTUBE_CHANNEL_ID']
        match=next((i for i in items if i['id']==expected),None)
        if not match: raise ValueError('The authorized YouTube channel does not match the configured destination.')
        return {'platform':platform,'id':expected,'label':match['snippet']['title']},token
    if platform=='facebook':
        expected=os.environ['PUBLISH_FACEBOOK_PAGE_ID'];token=os.environ['PUBLISH_FACEBOOK_TOKEN']
        data=api(graph()+'/'+urllib.parse.quote(expected,safe='')+'?fields=id,name',token)
        if data['id']!=expected: raise ValueError('Facebook Page mismatch.')
        return {'platform':platform,'id':expected,'label':data['name']},token
    expected=os.environ['PUBLISH_INSTAGRAM_ACCOUNT_ID'];token=os.environ['PUBLISH_INSTAGRAM_TOKEN']
    data=api(graph()+'/'+urllib.parse.quote(expected,safe='')+'?fields=id,username',token)
    if data['id']!=expected: raise ValueError('Instagram account mismatch.')
    return {'platform':platform,'id':expected,'label':'@'+data['username']},token

class Publisher:
    def __init__(self, client):
        self.client=client
        self.owner=os.getenv('PUBLISH_OWNER_ID','')
        self.last_sync=0
    def sync(self):
        if not self.owner or time.monotonic()-self.last_sync<240: return
        accounts=[]
        for platform in ('youtube','facebook','instagram'):
            if not configured(platform): continue
            try:
                account,_=identity(platform);accounts.append(account)
            except Exception:
                print('Publishing connection unavailable: '+platform,flush=True)
        self.client.json('publish/accounts',{'owner':self.owner,'accounts':accounts})
        self.last_sync=time.monotonic()
    def once(self):
        if not self.owner: return False
        self.sync()
        result=self.client.json('publish/claim',{'owner':self.owner})
        if not result.get('job'):return False
        self.process(result['job'])
        return True
    def process(self, job):
        claim={'id':job['id'],'token':job['token']}
        stopped=threading.Event()
        lost=threading.Event()
        def report(action, **body):
            if lost.is_set():raise ValueError('Publishing lease lost.')
            return self.client.json('publish/'+action,{**claim,**body})
        def heartbeat():
            while not stopped.wait(30):
                try:report('heartbeat')
                except Exception:lost.set();return
        thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
        try:
            account,token=identity(job['platform'])
            if account['id']!=job['account_id']:raise ValueError('Destination changed. Review the account before sending.')
            # Verify the exact immutable export exists before any external side effect.
            from worker import open_media
            with tempfile.TemporaryDirectory(prefix='loofy-publish-') as folder:
                path=pathlib.Path(folder)/'export.mp4'
                with open_media(job['url']) as source, path.open('wb') as target:
                    total=0
                    while chunk:=source.read(1024*1024):
                        total+=len(chunk)
                        if total>1024**3:raise ValueError('Export is too large.')
                        target.write(chunk)
                if not path.stat().st_size:raise ValueError('Empty export.')
                report('started')  # Persist before asking a platform to accept any content.
                if job['platform']=='youtube':self.youtube(job,token,path,report)
                elif job['platform']=='facebook':self.facebook(job,token,report)
                elif job['platform']=='instagram':self.instagram(job,token,report)
                report('finish')
        except Exception as exc:
            try:report('fail')
            except Exception:pass
            print('Publishing job '+job['id']+' needs attention ('+type(exc).__name__+').',flush=True)
        finally:
            stopped.set();thread.join(timeout=2)
    def youtube(self,job,token,path,report):
        data=job['payload'];size=path.stat().st_size
        metadata={'snippet':{'title':data['title'],'description':data['description'],'categoryId':'22'},'status':{'privacyStatus':data['privacy'],'selfDeclaredMadeForKids':data['madeForKids'],'containsSyntheticMedia':data['synthetic']}}
        _,headers,_=request('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status','POST',json.dumps(metadata).encode(),{'Authorization':'Bearer '+token,'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':str(size)})
        location=next(v for k,v in headers.items() if k.lower()=='location')
        if urllib.parse.urlsplit(location).hostname!='www.googleapis.com':raise ValueError('Invalid Google upload destination.')
        with path.open('rb') as source:
            offset=0
            while chunk:=source.read(8*1024*1024):
                report('heartbeat')
                end=offset+len(chunk)-1
                status,headers,result=request(location,'PUT',chunk,{'Content-Type':'video/mp4','Content-Length':str(len(chunk)),'Content-Range':f'bytes {offset}-{end}/{size}'},resume=True)
                offset=end+1
                if offset<size and status!=308:raise ValueError('Upload ended unexpectedly.')
                if offset==size:
                    if status not in (200,201) or not result.get('id'):raise ValueError('Upload confirmation missing.')
                    report('checkpoint',remoteId=result['id'])
    def facebook(self,job,token,report):
        base=graph();page=job['account_id'];data=job['payload']
        opened=api(base+'/'+page+'/video_reels',token,{'upload_phase':'start'})
        vid=opened['video_id'];report('checkpoint',remoteId=vid)
        upload=opened['upload_url']
        if urllib.parse.urlsplit(upload).hostname!='rupload.facebook.com':raise ValueError('Invalid Facebook upload destination.')
        _,_,sent=request(upload,'POST',b'',{'Authorization':'OAuth '+token,'file_url':job['url']})
        if not sent.get('success'):raise ValueError('Facebook did not accept the upload.')
        self.wait_meta(base+'/'+vid+'?fields=status',token,lambda d:d.get('status',{}).get('processing_phase',{}).get('status')=='complete',report)
        result=api(base+'/'+page+'/video_reels',token,{'upload_phase':'finish','video_id':vid,'video_state':'PUBLISHED','title':data['title'],'description':data['description']})
        if not result.get('success'):raise ValueError('Facebook did not confirm publishing.')
        self.wait_meta(base+'/'+vid+'?fields=status',token,lambda d:d.get('status',{}).get('publishing_phase',{}).get('status')=='complete',report)
    def instagram(self,job,token,report):
        base=graph();account=job['account_id'];data=job['payload']
        container=api(base+'/'+account+'/media',token,{'media_type':'REELS','video_url':job['url'],'caption':(data['title']+'\n\n'+data['description']).strip(),'share_to_feed':True})['id']
        report('checkpoint',remoteId=container)
        self.wait_meta(base+'/'+container+'?fields=status_code',token,lambda d:d.get('status_code')=='FINISHED',report)
        result=api(base+'/'+account+'/media_publish',token,{'creation_id':container})
        report('checkpoint',remoteId=result['id'])
    def wait_meta(self,url,token,ready,report):
        for _ in range(120):
            report('heartbeat');result=api(url,token)
            if ready(result):return
            if result.get('status_code') in ('ERROR','EXPIRED') or result.get('status',{}).get('video_status')=='error':raise ValueError('Platform processing failed.')
            time.sleep(5)
        raise ValueError('Platform processing timed out; check the destination before sending again.')
