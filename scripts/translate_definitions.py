#!/usr/bin/env python3
"""Cache translations of public dictionary glosses; the deployed app is fully offline.
Usage: python scripts/translate_definitions.py MODEL_SNAPSHOT.json CACHE.jsonl
Translations are keyed by exact source language/text and target language. Batches
are numbered and accepted only after a complete one-to-one alignment check.
"""
import concurrent.futures, hashlib, json, re, sys, threading, time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

snapshot=json.loads(Path(sys.argv[1]).read_text()); cache_path=Path(sys.argv[2])
texts=set(); by_word={n['w']:n for n in snapshot['nodes']}
def include(lang,text):
    if text and text.strip():texts.add((lang,text))
for n in snapshot['main']:
    source=n.get('source') or {}; lang=source.get('language','en')
    for text in source.get('senses') or ([] if n['az'] else [n['en']]):include(lang,text)
for records in snapshot['evidence'].values():
    for p in records:
        for key in ['sense','qualifier']:include(p.get('language','en'),p.get(key))
for f in snapshot['grammar']:
    for text in f['senses']:
        lang='az' if f['origin']=='original' and text==by_word.get(f['w'],{}).get('az') else 'en'
        include(lang,text)

cache={}
if cache_path.exists():
    for line in cache_path.open():
        r=json.loads(line);cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
for r in json.loads((Path(__file__).parent/'translation-edits.json').read_text()):
    cache[(r['source_language'],r['target_language'],r['text'])]=r['translation']
jobs={}
for lang,text in texts:
    for target in ['az','en']:
        if lang!=target and (lang,target,text) not in cache:jobs.setdefault((lang,target),[]).append(text)
lock=threading.Lock();request_lock=threading.Lock();next_request=[0.0];counts={'done':0,'failed':0};errors=[];stop=threading.Event()
def throttle():
    with request_lock:
        wait=max(0,next_request[0]-time.monotonic());next_request[0]=max(time.monotonic(),next_request[0])+.7
    if wait:time.sleep(wait)
def translate(lang,target,items):
    if stop.is_set():return
    payload=re.sub(r'\s+',' ',items[0]).strip() if len(items)==1 else '\n'.join(f'[{i:06d}] '+re.sub(r'\s+',' ',text).strip() for i,text in enumerate(items))
    url='https://translate.googleapis.com/translate_a/single?'+urlencode({'client':'gtx','sl':lang,'tl':target,'dt':'t','q':payload})
    last_error=None;split_batch=False
    for attempt in range(5):
        try:
            throttle()
            if stop.is_set():return
            request=Request(url,headers={'User-Agent':'SozToxumasiDictionary/1.0'})
            with urlopen(request,timeout=40) as response:data=json.load(response)
            translated=''.join(segment[0] or '' for segment in data[0] if segment)
            matches=list(re.finditer(r'\[\s*(\d{6})\s*\]',translated))
            if len(items)==1:values=[translated.strip()]
            else:
                if len(matches)!=len(items) or [int(m[1]) for m in matches]!=list(range(len(items))):raise ValueError('batch alignment failed')
                values=[translated[m.end():matches[i+1].start() if i+1<len(matches) else None].strip() for i,m in enumerate(matches)]
            if any(not v for v in values):raise ValueError('empty translation')
            with lock:
                with cache_path.open('a') as file:
                    for text,value in zip(items,values):
                        r={'source_language':lang,'target_language':target,'text':text,'translation':value,'engine':'Google Translate','method':'machine-translation'}
                        file.write(json.dumps(r,ensure_ascii=False)+'\n');cache[(lang,target,text)]=value
                counts['done']+=len(items)
            return
        except HTTPError as e:
            last_error=str(e)
            if e.code in [429,503]:
                stop.set()
                with lock:errors.append({'language':lang,'target':target,'error':'Service rate limit or unavailable; cached work saved. Retry later.'})
                return
            elif e.code in [400,414] and len(items)>1:split_batch=True;break
            else:time.sleep(min(20,2**attempt))
        except ValueError as e:
            last_error=str(e)
            if len(items)>1:split_batch=True;break
            time.sleep(2)
        except Exception as e:
            last_error=type(e).__name__+': '+str(e);time.sleep(min(20,2**attempt))
    if split_batch and len(items)>1:
        mid=len(items)//2;translate(lang,target,items[:mid]);translate(lang,target,items[mid:]);return
    with lock:counts['failed']+=1;errors.append({'language':lang,'target':target,'text':items[0],'error':last_error})

batches=[]
for (lang,target),items in sorted(jobs.items()):
    group=[]
    for text in sorted(items):
        candidate=group+[text];size=len(urlencode({'q':'\n'.join(f'[{i:06d}] '+s for i,s in enumerate(candidate))}))
        if group and (size>6500 or len(group)>=90):batches.append((lang,target,group));group=[]
        group.append(text)
    if group:batches.append((lang,target,group))
print(json.dumps({'cached_translations':len(cache),'pending_translations':sum(map(len,jobs.values())),'batches':len(batches)}),flush=True)
start=time.monotonic()
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures={pool.submit(translate,*batch) for batch in batches}
    while futures:
        completed,futures=concurrent.futures.wait(futures,timeout=15,return_when=concurrent.futures.FIRST_COMPLETED)
        for future in completed:future.result()
        if time.monotonic()-start>=15:
            print(json.dumps({**counts,'remaining_batches':len(futures)}),flush=True);start=time.monotonic()
if errors:
    cache_path.with_suffix('.errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2));print(json.dumps({'errors':len(errors)}),flush=True);sys.exit(1)
print(json.dumps({'completed':counts['done'],'total_cached':len(cache)}),flush=True)
