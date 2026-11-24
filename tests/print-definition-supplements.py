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
