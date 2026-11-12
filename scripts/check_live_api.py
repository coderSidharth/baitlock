"""Run live feature checks against localhost:8000 using disposable accounts.

Start the API first. Existing users and their data are never selected for
mutation. Each generated test account is removed in the cleanup block.
"""
import requests, uuid, json
from pathlib import Path
BASE='http://127.0.0.1:8000/api/v1'; results=[]; accounts=[]
def req(method,path,status=200,session=None,**kw):
 r=(session or requests).request(method,BASE+path,timeout=30,**kw)
 assert r.status_code==status,(method,path,r.status_code,r.text[:200])
 results.append([method,path,status]);return r

def account():
 email='qa-'+uuid.uuid4().hex[:12]+'@example.com';pw='QA-Password-2026!';s=requests.Session()
 req('POST','/auth/register',json={'email':email,'password':pw,'full_name':'QA Features'})
 a={'email':email,'password':pw,'session':s};accounts.append(a);login(a);return a

def login(a,form=False):
 kw={'data':{'username':a['email'],'password':a['password']}} if form else {'json':{'email':a['email'],'password':a['password']}}
 r=req('POST','/auth/login',**kw);a['session'].headers['Authorization']='Bearer '+r.json()['access_token']
try:
 for p in ['/live','/ready','/health']: req('GET',p)
 for p in ['/auth/me','/auth/sessions','/events','/phishing/whitelist','/phishing/blocklist','/chat/history']:
  req('GET',p,401);req('GET',p,401,headers={'Authorization':'Bearer invalid'})
 for body in [{'email':'bad','password':'long-enough'},{'email':'qa@example.com','password':'x'}]:req('POST','/auth/register',422,json=body)
 a=account();b=account();s=a['session'];other=b['session']
 req('POST','/auth/register',400,json={'email':a['email'].upper(),'password':a['password']})
 req('POST','/auth/login',401,json={'email':a['email'],'password':'wrong-password'})
 req('POST','/auth/login',400,json={'email':a['email'],'password':{}})
 login(a,True);req('GET','/auth/me',session=s);req('GET','/auth/sessions',session=s)
 req('PUT','/auth/me',session=s,json={'full_name':'QA Updated'})
 assert req('GET','/auth/me',session=s).json()['full_name']=='QA Updated'
 req('PUT','/auth/me',400,session=s,json={'email':'changed-'+a['email']})
 req('PUT','/auth/me',400,session=s,json={'email':b['email'],'current_password':a['password']})
 new='changed-'+a['email'];req('PUT','/auth/me',session=s,json={'email':new,'current_password':a['password']});a['email']=new
 login(a)
 for kind in ['whitelist','blocklist']:
  req('POST','/phishing/'+kind,session=s,json={'domain':'https://Qa.Example./test'})
  assert req('GET','/phishing/'+kind,session=s).json()[kind][0]['domain']=='qa.example'
  assert req('GET','/phishing/'+kind,session=other).json()[kind]==[]
  r=req('POST','/phishing/check',session=s,json={'url':'https://sub.qa.example/login','fast_mode':True}).json()
  assert r['tier']==('safe' if kind=='whitelist' else 'critical')
  req('POST','/phishing/'+kind,422,session=s,json={'domain':'[bad'})
  req('DELETE','/phishing/'+kind,422,session=s)
  req('DELETE','/phishing/'+kind,session=s,params={'domain':'qa.example'})
 for url in ['file:///etc/passwd','https://[bad','https://host:bad/','https://example.com/ bad']:
  req('POST','/phishing/check',422,session=s,json={'url':url})
 url='https://example.com/qa?private=not-a-real-secret'
 req('POST','/phishing/check',session=s,json={'url':url,'fast_mode':True})
 assert 'Cached' in req('POST','/phishing/check',session=s,json={'url':url,'fast_mode':True}).json()['verdict']
 req('POST','/phishing/check',session=s,json={'url':'http://127.0.0.1/qa-deep','fast_mode':False,'page_text':'Synthetic content for a local integration check.'})
 vote={'url':'qa.example','flag_type':'malicious'}
 one=req('POST','/companies/flag',201,session=s,json=vote).json();vote['flag_type']='legitimate'
 two=req('POST','/companies/flag',201,session=s,json=vote).json();assert one['id']==two['id']
 req('POST','/companies/flag',422,session=s,json={'url':'qa.example','flag_type':'invalid'})
 tx={'amount':42.5,'velocity':1,'hour':12,'geo_distance':8}
 req('POST','/fraud/score',session=s,json={'transaction':tx})
 for key,value in [('amount',0),('amount',1000001),('velocity',-1),('hour',24),('geo_distance',40076)]:
  req('POST','/fraud/score',422,session=s,json={'transaction':dict(tx,**{key:value})})
 all_events=req('GET','/events',session=s).json();assert all_events['total']>3
 assert not any('private=' in e['target'] for e in all_events['events'])
 for kind in ['phishing','fraud']:
  assert all(e['type']==kind for e in req('GET','/events',session=s,params={'type':kind}).json()['events'])
 first=req('GET','/events',session=s,params={'limit':1,'offset':0}).json();second=req('GET','/events',session=s,params={'limit':1,'offset':1}).json();assert first['events'][0]['id']!=second['events'][0]['id']
 for params in [{'limit':0},{'limit':101},{'offset':-1},{'type':'invalid'}]:req('GET','/events',422,session=s,params=params)
 assert req('GET','/events',session=other).json()['total']==0
 for body in [{'role':'assistant','content':'test'},{'content':''},{'content':'x'*8001}]:req('POST','/chat',422,session=s,json=body)
 req('POST','/chat',session=s,json={'content':'Reply with QA READY. This is a synthetic test.'})
 assert len(req('GET','/chat/history',session=s).json()['messages'])>=2
 assert req('GET','/chat/history',session=other).json()['messages']==[]
 req('DELETE','/chat/history',session=s);assert req('GET','/chat/history',session=s).json()['messages']==[]
 req('DELETE','/events',204,session=other);assert req('GET','/events',session=s).json()['total']==all_events['total']
 req('DELETE','/events',204,session=s);assert req('GET','/events',session=s).json()['total']==0
 req('PUT','/auth/me',422,session=s,json={'password':'a-new-password'})
 req('PUT','/auth/me',400,session=s,json={'password':'a-new-password','current_password':'wrong-password'})
 old=dict(s.headers);req('PUT','/auth/me',session=s,json={'password':'a-new-password','current_password':a['password']});a['password']='a-new-password'
 req('GET','/auth/me',401,headers=old);login(a)
 req('DELETE','/auth/me',403,session=s,json={'current_password':'wrong-password'})
 req('POST','/auth/logout',204,session=s);req('GET','/auth/me',401,session=s);login(a)
finally:
 for a in accounts:
  login(a);req('DELETE','/auth/me',204,session=a['session'],json={'current_password':a['password']})
 Path('/tmp/baitlock-feature-api-results.json').write_text(json.dumps(results,indent=2))
print('PASS',len(results),'HTTP feature checks; temporary accounts removed')
