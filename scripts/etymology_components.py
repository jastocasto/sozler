"""Select lexical template components, preserving explicit affix roles.
An affix argument may omit its hyphen in Wiktionary template syntax. It must
never become a free-word edge merely because that spelling is also a headword.
"""
def lexical_components(template):
 name=template.get('name');args=template.get('args',{})
 if args.get('1')!='az':return []
 if name in ['suffix','suf']:positions=['2']
 elif name in ['prefix','pre']:positions=['3']
 elif name in ['compound','com']:positions=sorted((k for k in args if k.isdigit() and int(k)>=2),key=int)
 elif name in ['affix','af']:
  positions=sorted((k for k in args if k.isdigit() and int(k)>=2),key=int)
  # Generic affix templates need rendered morphology to distinguish a bound
  # component from a same-spelled independent word. Unrendered cases wait.
  pieces=template.get('expansion','').split(' + ')
  if len(pieces)!=len(positions):return []
  positions=[k for k,piece in zip(positions,pieces) if not piece.strip().startswith('-') and (not piece.strip().endswith('-') or str(args[k]).endswith(('maq','mək')))]
 else:return []
 return list(dict.fromkeys(args[k] for k in positions if args.get(k) and not args[k].startswith('-') and not args[k].endswith('-')))

def complete_derived_target(reference):
 """Do not promote a bare linked verb extracted from an incomplete idiom.

 Kaikki marks these as phrases, but the visible phrase's unlinked component
 may be absent from word. Reconstructing that missing text would be guessing.
 """
 word=reference.get('word','')
 if 'phrase' in reference.get('tags',[]) and not any(c.isspace() for c in word):return None
 return word
