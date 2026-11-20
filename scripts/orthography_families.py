"""Build shared word families and original glosses from directional derivation evidence."""
from collections import defaultdict
from functools import cache
import re

_SIMPLE = re.compile(r'^[a-zçğəıöşü]+$')

def build(by_word, letter_words, claims, homonyms, blocked, manual, aliases=None):
    aliases = aliases or {}
    groups = defaultdict(set)
    parents = defaultdict(dict)
    reviewed = {}
    for child, base, kind, priority, refs in claims:
        if child == base or child not in by_word or base not in by_word:
            continue
        if not _SIMPLE.fullmatch(child) or not _SIMPLE.fullmatch(base):
            continue
        if (*sorted([child,base]),'root') in blocked:
            continue
        previous=parents[child].get(base)
        if previous is None or priority > previous[1]:
            parents[child][base]=(kind,priority,refs)
    for family in manual.get('families',[]):
        anchor=family['root']
        reviewed[anchor]=family
        for word in family['members']:
            if word!=anchor and word in by_word and anchor in by_word and (*sorted([word,anchor]),'root') not in blocked:
                parents[word][anchor]=('review',100,family['refs'])
    selected={}
    for word,candidates in parents.items():
        best=max(proof[1] for proof in candidates.values())
        options={parent:proof for parent,proof in candidates.items() if proof[1]==best}
        if len(options)==1:
            selected[word]=next(iter(options.items()))

    def family_root(word):
        chain=set()
        current=word
        while current in selected:
            if current in chain:
                return None
            chain.add(current)
            child=current
            current=selected[current][0]
            if current in homonyms and child not in reviewed.get(current,{}).get('members',[]):
                return None
        return current

    for word in [*selected,*[w for w in reviewed if w not in selected]]:
        anchor=family_root(word)
        if anchor and anchor!=word:
            groups[anchor].update((word,anchor))
    families=[]
    for anchor,members in sorted(groups.items()):
        if not members.intersection(letter_words):
            continue
        sources={}
        for word in sorted(members):
            chain=set()
            here=word
            while here in selected and here not in chain:
                chain.add(here)
                here,(_,_,refs)=selected[here]
                for ref in refs:
                    if ref['url'] not in sources:
                        sources[ref['url']]=ref
            if len(sources)>=5:
                break
        if anchor in reviewed:
            sources={ref['url']:ref for ref in reviewed[anchor]['refs']}|sources
        families.append([by_word[anchor]['w'],[by_word[word]['w'] for word in sorted(members)],list(sources.values())[:5]])

    # Original glosses describe a licensed or already-defined lexical base.
    # English phrase pieces come from the same English inflector as the wheel.
    definitions={}
    for word,item in manual.get('definitions',{}).items():
        if word in letter_words and word in by_word:
            forms = by_word[word].get('verbForms')
            definitions[word] = {**item, 'verbForms': forms} if item.get('pos') == 'verb' and forms else item

    @cache
    def definition(word,seen=()):
        if word in seen:
            return None
        item=definitions.get(word)
        if item:
            return item
        current=by_word[word]
        if current.get('definitionAuditStatus')=='needs-review':
            return None
        if current.get('az') and current.get('en'):
            return current
        if word in aliases:
            parent, reference = aliases[word]
            base = definition(parent, (*seen, word))
            if base and base.get('pos') not in (None, 'word', 'form'):
                references = {reference['url']: reference}
                for ref in base.get('refs') or base.get('definitionSources') or []:
                    references.setdefault(ref['url'], ref)
                item = {field: base[field] for field in ('az', 'en', 'pos', 'verbForms') if field in base}
                definitions[word] = {**item, 'refs': list(references.values())}
                return definitions[word]
        candidate=selected.get(word)
        if not candidate or word not in letter_words:
            return None
        parent,(kind,priority,refs)=candidate
        if priority<80 and kind!='action':
            return None
        base=definition(parent,(*seen,word))
        if not base or (priority<80 and (not by_word[parent].get('en') or len(base.get('bilingualSenses',[]))>1)):
            return None
        result=describe_derivative(parent,kind,base)
        if not result:
            return None
        references={ref['url']:ref for ref in refs}
        for ref in (base.get('refs') or base.get('definitionSources') or [])[:2]:
            if ref.get('url','').startswith('https://'):
                references.setdefault(ref['url'],ref)
        result['refs']=list(references.values())
        definitions[word]=result
        return result

    for word in sorted(letter_words):
        definition(word)
    return families,{by_word[word]['w']:{k:v for k,v in item.items() if k!='verbForms'} for word,item in definitions.items()}

def describe_derivative(parent,kind,base):
    forms=base.get('verbForms') or {}
    if kind=='action' and forms.get('ing'):
        return {'az':f'«{parent}» felinin bildirdiyi hərəkət və ya proses.', 'en':f'The act or process of {forms["ing"]}.', 'pos':'noun'}
    if kind=='causative' and forms.get('base'):
        phrase=f'someone or something to {forms["base"]}'
        return {'az':f'«{parent}» hərəkətinə səbəb olmaq və ya onu başqasına etdirmək.', 'en':f'To cause {phrase}.', 'pos':'verb',
                'verbForms':{'base':f'cause {phrase}','ing':f'causing {phrase}','participle':f'caused {phrase}'}}
    if kind=='passive' and forms.get('participle'):
        phrase=forms['participle']
        phrase=re.sub(r' (?:(?:someone|something) or (?:someone|something)|someone|something|it|a place)(?= |$)', '', phrase, count=1)
        if phrase.startswith('been ') or len(phrase)<3:
            return None
        return {'az':f'«{parent}» hərəkətinə məruz qalmaq.', 'en':f'To be {phrase}.', 'pos':'verb',
                'verbForms':{'base':f'be {phrase}','ing':f'being {phrase}','participle':f'been {phrase}'}}
    return None
