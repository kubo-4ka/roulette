#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

# Python/Firefox の代わりに結果のみを返し、親シェルへの受け渡しを検証。
python3() { printf '%s\n' neovim; }
before_options=$-
source ./roulette.sh
[[ "$ROULETTE_RESULT" == neovim ]]
[[ "$-" == "$before_options" ]]

python3() { return 1; }
ROULETTE_RESULT=stale
if source ./roulette.sh; then
    echo 'expected failure' >&2
    exit 1
fi
[[ ! -v ROULETTE_RESULT ]]

python3() { printf '%s\n' emacs; }
export -f python3
[[ "$(bash ./roulette.sh)" == emacs ]]
python3() { return 1; }
export -f python3
if bash ./roulette.sh; then
    echo 'expected executable failure' >&2
    exit 1
fi
printf '%s\n' 'shell: source/execute success and failure passed'
