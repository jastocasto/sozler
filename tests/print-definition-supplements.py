"""Exercise reviewed checkpoints with small fixtures, including a later reviewer block."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_print_definitions as builder


class SupplementCheckpointTest(unittest.TestCase):
    def test_only_unverified_compound_edges_can_be_removed(self):
        model = {'nodes': [dict(w=w, page=1, az='', en='') for w in ['a', 'b', 'c']],
                 'edges': [], 'blocked': []}
        source = {'title': 'Dictionary', 'url': 'https://example.org/a'}
        refs = [list(ref.values()) for ref in [builder.spelling_source(1), builder.SPELLING_RULES, source]]
        old = ['«b» və «c» sözlərindən düzələn mürəkkəb söz.', 'compound of b and c', 'noun', [0, 1], 'rule']
        edges = [['a', target, 'topic', 'Mürəkkəb söz · tərkib hissəsi', [['a', 'Part.', 'component', ids]]]
                 for target, ids in [('b', [0, 1]), ('c', [0, 1, 2])]]
        entry = {'az': 'Bir məna.', 'en': 'one sense', 'pos': 'noun', 'references': [source],
                 'omit_components': ['c']}
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            root = Path(tmp)
            (root / 'meanings').mkdir()
            batch = root / 'meanings/supplement-01.json'
            output = root / 'print-definitions.js'
            with patch.multiple(builder, OUTPUT=output, ATTRIBUTION=root / 'meta.json', CONTENT=root):
                meta = {'summary': {'undefined_before': 3, 'stats': {'links:compound': 1}}}
                batch.write_text(json.dumps({'a': entry}))
                with self.assertRaisesRegex(ValueError, 'No inferred component to omit'):
                    builder.write_supplemented_output(model, refs, {'a': old}, edges, meta, [])
                self.assertFalse(output.exists())

                entry['omit_components'] = ['b']
                entry['links'] = {'syn': ['b']}
                batch.write_text(json.dumps({'a': entry}))
                builder.write_supplemented_output(model, refs, {'a': old}, edges, meta, [])
                header, footer = builder.LOADER.split('DATA')
                _, definitions, updated_edges, _ = json.loads(output.read_text()[len(header):-len(footer)])
                self.assertEqual(len(definitions['a']), 5, 'the misleading formation note is gone')
                self.assertEqual(updated_edges[0], edges[1], 'the sourced component link survives')
                self.assertEqual(updated_edges[1][:3], ['a', 'b', 'syn'])
                self.assertEqual(meta['summary']['stats']['links:compound'], 0)
                self.assertEqual(meta['summary']['stats']['links:meaning-sense'], 1)

    def test_retry_and_changed_review(self):
        model = {'nodes': [dict(w=w, page=1, az='', en='') for w in ['a', 'b']],
                 'edges': [], 'blocked': []}
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            root = Path(tmp)
            model_file = root / 'model.json'
            model_file.write_text(json.dumps(model))
            (root / 'meanings').mkdir()
            output = root / 'print-definitions.js'
            attribution = root / 'print-definitions-attribution.json'
            with patch.multiple(builder, OUTPUT=output, ATTRIBUTION=attribution, CONTENT=root), \
                 patch.object(sys, 'argv', ['build', str(model_file), '--from-reviewed', str(root)]):
                meta = {'summary': {'undefined_before': 2, 'stats': {}}}
                builder.write_supplemented_output(model, [], {}, [], meta, [])
                source = {'a': {'az': 'Bir məna.', 'en': 'one sense', 'pos': 'noun',
                                'references': [{'title': 'Dictionary', 'url': 'https://example.org/a'}],
                                'links': {'topic': ['b']}}}
                (root / 'meanings/supplement-01.json').write_text(json.dumps(source))
                builder.main()
                result = output.read_bytes(), attribution.read_bytes()
                self.assertEqual(json.loads(result[1])['summary']['links'], 1)
                builder.main()
                self.assertEqual((output.read_bytes(), attribution.read_bytes()), result)

                model['blocked'].append(['a', 'b'])
                model_file.write_text(json.dumps(model))
                with self.assertRaisesRegex(ValueError, 'matching --without-print model'):
                    builder.main()
                self.assertEqual((output.read_bytes(), attribution.read_bytes()), result)


if __name__ == '__main__':
    unittest.main()
