import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
from etymology_components import lexical_components, complete_derived_target
class Morphology(unittest.TestCase):
 def test_attested_affixes_do_not_become_homograph_words(self):
  # Actual source templates that previously emitted pearl, you, work, deaf,
  # stone and year as alleged lexical roots.
  cases=[('beşinci','beş','inci'),('evsiz','ev','siz'),('dönüş','dönmək','iş'),('xilaskar','xilas','kar'),('vətəndaş','vətən','daş'),('doğulmaq','doğmaq','il')]
  for derived,base,affix in cases:
   with self.subTest(word=derived):self.assertEqual(lexical_components({'name':'suf','args':{'1':'az','2':base,'3':affix}}),[base])
 def test_actual_compound_uses_are_not_blocked_by_spelling(self):
  self.assertEqual(lexical_components({'name':'compound','args':{'1':'az','2':'inci','3':'çiçək'}}),['inci','çiçək'])
  self.assertEqual(lexical_components({'name':'com','args':{'1':'az','2':'daş','3':'kömür'}}),['daş','kömür'])
 def test_prefix_role_and_rendered_generic_affixes(self):
  self.assertEqual(lexical_components({'name':'pre','args':{'1':'az','2':'bi','3':'xəbər'}}),['xəbər'])
  self.assertEqual(lexical_components({'name':'af','args':{'1':'az','2':'vətən','3':'daş'},'expansion':'vətən + -daş'}),['vətən'])
  self.assertEqual(lexical_components({'name':'af','args':{'1':'az','2':'doğmaq','3':'il'},'expansion':'doğ- + -ul'}),['doğmaq'])
 def test_split_idiom_targets_do_not_become_bare_verb_roots(self):
  for word in ['gəlmək','hopmaq','sinmək','istəmək']:
   self.assertIsNone(complete_derived_target({'word':word,'tags':['phrase']}))
  self.assertEqual(complete_derived_target({'word':'can atmaq','tags':['phrase']}),'can atmaq')
  self.assertEqual(complete_derived_target({'word':'canlı'}),'canlı')
 def test_unresolved_generic_roles_are_not_guessed(self):
  self.assertEqual(lexical_components({'name':'af','args':{'1':'az','2':'ev','3':'siz'}}),[])
  self.assertEqual(lexical_components({'name':'suf','args':{'1':'tr','2':'ev','3':'siz'}}),[])
unittest.main()
