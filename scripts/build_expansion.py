#!/usr/bin/env python3
"""Append distinct editorial headwords; never rewrite previous vocabulary or grammar."""
import collections,datetime,hashlib,json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parent.parent;content=root/'scripts/content';out=root/'dist'
def read(name):return json.loads((out/(name+'.js')).read_text().split('=',1)[1].strip().rstrip(';'))
def key(word):return unicodedata.normalize('NFC',word).replace('İ','i').replace('I','ı').lower()
old=[n for name in ['data','lexicon','vocabulary','review'] for n in read(name)['nodes']];known={key(n[0]):n[0] for n in old};prior=set(known)
nodes=[];edges=[];skipped=[];references=[];topics=collections.Counter()
variants=json.loads((content/'exclusions.json').read_text())
for category in ['science','technology','culture']:
    records=json.loads((content/f'expansion-{category}.json').read_text())
    notes=json.loads((content/f'expansion-{category}-sources.json').read_text());references.append({'category':category,'notes':notes})
    for n in records:
        word=n['w'];k=key(word)
        if word in variants:
            assert key(variants[word]) in prior
            skipped.append({'word':word,'category':category,'reason':'variant of existing '+variants[word]});continue
        if k in known:skipped.append({'word':word,'category':category,'reason':'already represented'});continue
        assert re.fullmatch(r'[a-zəöüğşçı][a-zəöüğşçı -]+',word),word
        assert len(n['az'])>18 and len(n['en'])>15,word
        assert not re.search('[\u0400-\u04ff]',n['az']+n['en']),word
        if n['pos']=='verb':assert word.endswith(('maq','mək')) and not word.endswith(('mamaq','məmək')),word
        assert key(n['anchor']) in prior,(word,n['anchor'])
        source={'kind':'editorial','head':word,'method':'AI-assisted bilingual editorial definition','category':category}
        nodes.append([word,n['en'],n['az'],n['pos'],n['topic'],'','','editorial',source]);known[k]=word;topics[n['topic']]+=1
        edges.append([word,known[key(n['anchor'])],'topic','Mövzu əlaqəsi · SÖZ'])
assert len(nodes)>=500
preserved={name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in ['data.js','lexicon.js','vocabulary.js','review.js','bilingual.js','grammar.js','grammar-archive.json']}
meta={'added_entries':len(nodes),'single_words':sum(' ' not in n[0] for n in nodes),'multiword_terms':sum(' ' in n[0] for n in nodes),'display_languages':['az','en'],'created_at':datetime.date.today().isoformat(),'method':'Original AI-assisted editorial definitions. Spelling and terminology spot-checks are documented separately; the full set has not been reviewed by a linguist.','relationships':'Topic links only. No inferred synonyms, antonyms, roots, or conjugations.','topics':dict(topics),'preserved_files':preserved}
(out/'expansion.js').write_text('window.WORD_WEB_EXPANSION='+json.dumps({'nodes':nodes,'edges':edges,'meta':meta},ensure_ascii=False,separators=(',',':'))+';\n')
(out/'expansion-attribution.json').write_text(json.dumps({'meta':meta,'references':references,'deduplicated':skipped,'license':'New editorial definitions are provided under CC BY-SA 4.0, consistent with the dictionary collection. Reference sources support spelling and terminology; their prose has not been copied.'},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'added':len(nodes),'single_words':meta['single_words'],'multiword_terms':meta['multiword_terms'],'skipped':skipped},ensure_ascii=False))
