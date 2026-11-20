#!/usr/bin/env python3
"""Build the v12 vocabulary layer without modifying any previous dictionary data."""
import collections,hashlib,json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parent.parent;out=root/'dist';content=root/'scripts/content/additions'
def read(name):return json.loads((out/(name+'.js')).read_text().split('=',1)[1].strip().rstrip(';'))
def key(w):return unicodedata.normalize('NFC',w).replace('İ','i').replace('I','ı').lower()
old=[r for name in ['data','lexicon','vocabulary','review','expansion'] for r in read(name)['nodes']]
known={key(r[0]):r[0] for r in old};prior=set(known);variants=json.loads((content/'exclusions.json').read_text())
config={'medicine':('tibb','health'),'biology':('biologiya','biology'),'earth':('geologiya','land'),'mathematics':('riyaziyyat','math'),'engineering':('mühəndislik','engineering'),'arts':('sənət','arts')}
nodes=[];edges=[];skipped=[];categories=collections.Counter()
for category,(default_anchor,group) in config.items():
 for line in (content/(category+'.tsv')).read_text().splitlines():
  word,az,en=line.split('|');k=key(word)
  if word in variants:
   assert key(variants[word]) in prior
   skipped.append({'word':word,'reason':'Variant of existing '+variants[word]});continue
  if k in known:skipped.append({'word':word,'reason':'Already represented'});continue
  assert word==unicodedata.normalize('NFC',word),word
  assert re.fullmatch(r'[a-zəöüğşçı]+',word),word
  assert len(az)>18 and len(en)>15 and not re.search('[\u0400-\u04ff]',az+en),word
  anchor=default_anchor;nav=group
  # Topic navigation only; none of these rules creates a synonym or root edge.
  if category=='medicine':
   if 'hormon' in az:anchor='hormon';nav='biology'
   elif any(x in az for x in ['hüceyrə','rüşeym','qişa']):anchor='hüceyrə';nav='body'
   elif any(x in az for x in ['müayinə','ölçülməsi']):anchor='müayinə'
   elif 'müalicə' in az or 'terapiya' in word:anchor='müalicə'
   elif 'qan' in az:anchor='qan'
  elif category=='biology':
   if any(x in en.lower() for x in ['plant','chloroplast','botany','photosynthesis']):anchor='bitki';nav='plants'
   elif any(x in en.lower() for x in ['chromosom','genetic','dna','rna','allele','gene locus']):anchor='genetika'
   elif any(x in en.lower() for x in ['habitat','community','soil','environment','pollution']):anchor='ekologiya';nav='environment'
   elif any(x in en.lower() for x in ['zoology','primates','worms']):anchor='heyvan';nav='animals'
  elif category=='earth':
   if 'mineral' in en.lower():anchor='mineral';nav='physical'
   elif 'rock' in en.lower():anchor='süxur'
   elif any(x in en.lower() for x in ['water','river','ocean']):anchor='hidrologiya'
  elif category=='mathematics':
   if any(x in en.lower() for x in ['curve','surface','solid','polytope','polyhed','geometric']):anchor='həndəsə'
   elif any(x in en.lower() for x in ['statistic','distribution','data','mean','random','stochastic']):anchor='statistika'
   elif any(x in en.lower() for x in ['logical','statement','truth']):anchor='məntiq'
  elif category=='engineering':
   if any(x in en.lower() for x in ['circuit','semiconductor','signal']):anchor='elektronika'
   elif any(x in en.lower() for x in ['metal','steel','iron','chromium','nickel','zinc']):anchor='metal'
   elif any(x in en.lower() for x in ['polymer','rubber','gel']):anchor='polimer'
   elif any(x in en.lower() for x in ['shaft','rotation','transmission','mechanic']):anchor='mexanika'
  elif category=='arts':
   if any(x in en.lower() for x in ['weaving','woven','textile','felt']):anchor='toxuculuq'
   elif any(x in en.lower() for x in ['book','manuscript']):anchor='kitab';nav='learning'
   elif any(x in en.lower() for x in ['painting','print','engraving','image']):anchor='rəsm'
   elif any(x in en.lower() for x in ['histor','archive','archival']):anchor='tarix'
   elif 'museum' in en.lower():anchor='muzey'
  assert key(anchor) in prior,(word,anchor)
  source={'kind':'editorial','head':word,'method':'AI-assisted bilingual editorial definition','category':category,'navigationGroup':nav,'attribution':'additions-attribution.json'}
  nodes.append([word,en,az,'noun',category,'','','editorial',source]);known[k]=word;categories[category]+=1
  edges.append([word,known[key(anchor)],'topic','Mövzu əlaqəsi · SÖZ'])
assert len(nodes)>=500
preserved={name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in ['data.js','lexicon.js','vocabulary.js','review.js','bilingual.js','grammar.js','grammar-archive.json','expansion.js','learning-data.js','nominal.js','nominal-archive.json']}
meta={'added_entries':len(nodes),'single_words':len(nodes),'multiword_terms':0,'display_languages':['az','en'],'created_at':'2026-11-14','categories':dict(categories),'method':'New AI-assisted editorial definitions. Limited external terminology spot-checks are documented separately. This is not a frequency list or a linguist-reviewed dictionary.','relationships':'Topic links only; no inferred synonyms, antonyms or etymologies. No case forms or verb conjugations.','preserved_files':preserved}
(out/'additions.js').write_text('window.WORD_WEB_ADDITIONS='+json.dumps({'nodes':nodes,'edges':edges,'meta':meta},ensure_ascii=False,separators=(',',':'))+';\n')
refs=json.loads((content/'references.json').read_text()) if (content/'references.json').exists() else []
(out/'additions-attribution.json').write_text(json.dumps({'meta':meta,'references':[{k:v for k,v in r.items() if k!='sample'} for r in refs],'deduplicated':skipped,'license':'New editorial definitions: CC BY-SA 4.0. Reference pages support only the specified spot-checks; their prose is not used as dictionary definitions.'},ensure_ascii=False,indent=2)+'\n')
counts=read('nominal')['meta'].copy();counts.update(previous_headwords=counts['headwords'],added_entries=len(nodes),headwords=counts['headwords']+len(nodes),single_words=counts['single_words']+len(nodes),additions='additions-attribution.json',preserved_files=preserved)
(out/'word-count.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'added':len(nodes),'headwords':counts['headwords'],'single_words':counts['single_words'],'skipped':skipped},ensure_ascii=False))
