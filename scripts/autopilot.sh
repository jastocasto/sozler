#!/bin/bash
# Unattended improvement loop (owner-approved, 22 Nov 2026). See HANDOFF.md "Autopilot".
#
#   scripts/autopilot.sh setup        build the print-dictionary caches and model export in .cache/print (once per container)
#   scripts/autopilot.sh queue [N]    print the next N words that need an AI-written definition (default 250)
#   scripts/autopilot.sh next-batch   print the next free authored batch number (NN)
#   scripts/autopilot.sh meaning-queue [N]  print the next N words whose definition only says how they are built
#   scripts/autopilot.sh rebuild      rebuild every generated file from the batches and run the quick tests
#   scripts/autopilot.sh release      full test suite; if only the known failures remain, publish HEAD to
#                                     soz-toxumasi (fast-forward only) and check the live site
#
# Every step exits non-zero on failure. Commit and push the branch before `release`.
set -euo pipefail
cd "$(dirname "$0")/.."
P=.cache/print
# Tests that already failed before the November 2026 work, at the same assertion (HANDOFF.md "Known test status").
KNOWN_FAILURES="additions-data atlas-zoom-interactions bilingual-interactions complete-web-interactions continuous-gathering galaxy-data galaxy-interactions gathering-interactions grammar-interactions interactions nominal-data nominal-interactions pinch-zoom reference-completion relation-audit-data relation-audit-interactions responsive-interactions selection-magnet verification-data word-info-and-physics"

case "${1:-}" in
setup)
  mkdir -p $P/pdf
  for v in 1 2 3 4; do [ -s $P/pdf/v$v.pdf ] || curl -sf --retry 4 -o $P/pdf/v$v.pdf "https://www.urmu.eu/Azerbaycan_dilinin_izahli_lugeti_$v.pdf"; done
  [ -s $P/pdf/musayev.pdf ] || curl -sf --retry 4 -o $P/pdf/musayev.pdf "https://urmu.eu/Azerbaycanca_Ingilisce_luget.pdf"
  if [ ! -s $P/izahli.sqlite ] || [ ! -s $P/musayev.sqlite ]; then
    python3 scripts/extract_print_dictionaries.py --explanatory $P/pdf/v1.pdf $P/pdf/v2.pdf $P/pdf/v3.pdf $P/pdf/v4.pdf \
      --explanatory-db $P/izahli.sqlite --bilingual $P/pdf/musayev.pdf --bilingual-db $P/musayev.sqlite
  fi
  node scripts/export_print_definition_model.cjs $P/model.json --without-print
  echo "SETUP OK"
  ;;
queue)
  python3 scripts/list_authoring_queue.py $P/model.json $P/izahli.sqlite $P/musayev.sqlite "${2:-250}"
  ;;
meaning-queue)
  python3 scripts/list_meaning_queue.py $P/model.json $P/izahli.sqlite $P/musayev.sqlite "${2:-150}"
  ;;
next-batch)
  python3 -c "import os;have={int(f[6:8]) for f in os.listdir('scripts/content/print-definitions/authored') if f.startswith('batch-') and f.endswith('.json') and 'part' not in f};print('%02d'%(max(have)+1))"
  ;;
rebuild)
  python3 scripts/build_print_definitions.py $P/model.json $P/izahli.sqlite $P/musayev.sqlite
  python3 scripts/write_print_definitions_readme.py
  node --max-old-space-size=8192 scripts/build_runtime.cjs
  # Nouns defined since the last stem build get a k/q and vowel-loss decision (existing decisions are kept).
  before=$(md5sum scripts/content/nouns/stems.json)
  node --max-old-space-size=6144 scripts/build_noun_stems.cjs --extend > /dev/null
  [ "$before" = "$(md5sum scripts/content/nouns/stems.json)" ] || node --max-old-space-size=8192 scripts/build_runtime.cjs
  # New meanings and base words move spelling words into their topic groups on the map.
  node --max-old-space-size=8192 scripts/build_galaxy.cjs > /dev/null
  python3 scripts/version_assets.py
  python3 scripts/build_offline.py > /dev/null
  out=$(scripts/run_tests.sh tests/print-definitions-data.cjs tests/orthography-participation.cjs tests/morphology.cjs tests/noun-tables.cjs tests/frequency-and-origins.cjs tests/offline.cjs tests/whole-word-labels.cjs)
  echo "$out"
  if echo "$out" | grep -q '^FAIL'; then echo "REBUILD FAILED"; exit 1; fi
  echo "REBUILD OK"
  ;;
release)
  [ -z "$(git status --porcelain)" ] || { echo "Uncommitted changes: commit and push first"; exit 1; }
  branch=$(git rev-parse --abbrev-ref HEAD); git fetch -q origin "$branch" soz-toxumasi
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/$branch)" ] || { echo "HEAD is not pushed"; exit 1; }
  git merge-base --is-ancestor origin/soz-toxumasi HEAD || { echo "soz-toxumasi is not an ancestor of HEAD; not publishing"; exit 1; }
  rm -rf .cache/test-logs
  results=$(scripts/run_tests.sh)
  failing=$(echo "$results" | awk '/^FAIL/{sub(/\.cjs$/,"",$2);print $2}' | sort)
  new=$(comm -23 <(echo "$failing") <(echo $KNOWN_FAILURES | tr ' ' '\n' | sort) | grep -v '^$' || true)
  if [ -n "$new" ]; then echo "NEW TEST FAILURES, not publishing:"; echo "$new"; exit 1; fi
  echo "Tests: $(echo "$results" | grep -c '^PASS') pass; only known failures remain"
  sha=$(git rev-parse --short HEAD)
  git push origin HEAD:refs/heads/soz-toxumasi
  want=$(grep -o 'soz-core.json?v=[0-9a-f]*' dist/index.html)
  for i in $(seq 1 120); do [ "$(curl -s --max-time 10 https://soz-toxumasi.vercel.app/ | grep -o 'soz-core.json?v=[0-9a-f]*')" = "$want" ] && break; sleep 5; done
  node scripts/live_check.cjs https://soz-toxumasi.vercel.app/
  echo "RELEASED $sha"
  ;;
*)
  sed -n 2,12p "$0"; exit 2
  ;;
esac
