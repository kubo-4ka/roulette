#!/usr/bin/env bash
# source すると呼び出し元に ROULETTE_RESULT を設定。シェルオプションは変更しない。
if ROULETTE_RESULT="$(python3 "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/roulette.py")"; then
    if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
        printf '%s\n' "$ROULETTE_RESULT"
    fi
else
    unset ROULETTE_RESULT
    if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
        exit 1
    fi
    return 1
fi
