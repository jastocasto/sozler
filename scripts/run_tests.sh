#!/bin/bash
# Run the regression tests three at a time and print PASS/FAIL per test.
# Usage: scripts/run_tests.sh [tests/name.cjs ...]   (default: every test)
# Interaction tests need linkedom; it is installed once into .cache/linkedom.
set -u
cd "$(dirname "$0")/.."
# NODE_PATH may already be set (e.g. to a global folder with Playwright) without linkedom.
if ! node -e "require.resolve('linkedom')" >/dev/null 2>&1; then
  if [ ! -d .cache/linkedom/node_modules/linkedom ]; then
    mkdir -p .cache/linkedom && (cd .cache/linkedom && npm init -y >/dev/null && npm install linkedom@0.18.12 --silent >/dev/null 2>&1)
  fi
  export NODE_PATH="$PWD/.cache/linkedom/node_modules${NODE_PATH:+:$NODE_PATH}"
fi
mkdir -p .cache/test-logs
run() { t=$1; s=$(date +%s); if timeout 900 node --max-old-space-size=4096 "$t" > ".cache/test-logs/$(basename "$t").txt" 2>&1; then r=PASS; else r=FAIL; fi; echo "$r $(basename "$t") $(( $(date +%s)-s ))s"; }
export -f run
TESTS=("$@"); [ ${#TESTS[@]} -eq 0 ] && TESTS=(tests/*.cjs)
printf '%s\n' "${TESTS[@]}" | grep -v galaxy-harness | xargs -P 3 -I{} bash -c 'run {}' | sort
