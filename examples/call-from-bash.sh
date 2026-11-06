#!/usr/bin/env bash
set -euo pipefail

# funny.sh の git clone 後にある source roulette.sh と同じ呼び出し。
# 実行権限の付与は source には不要。
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/roulette.sh"

# この時点で ROULETTE_RESULT が vim / neovim / vscode / emacs のいずれか。
# 結果を使う処理はここからご自身で追加してください。
