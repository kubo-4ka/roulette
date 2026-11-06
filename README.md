# エディタルーレット

起動すると `vim` / `neovim` / `vscode` / `emacs` の4種類で自動抽選します。
開始時の向きはランダムです。項目の作成・設定・開始ボタンの操作は不要です。
4つの扇形は同じ大きさで、表示の針が指した項目を結果として返します。

## Bash から実行する（Linux デスクトップ）

必要なもの：Bash、Python 3（標準ライブラリのみ）、`PATH` 上の Firefox、
Firefox を表示できるデスクトップ環境。エディタのインストールは行いません。
Windows / macOS はこの起動スクリプトの対応対象外です。

```bash
git clone https://github.com/25325-sudo/roulette.git
cd roulette
source ./roulette.sh
# ここで ROULETTE_RESULT に vim / neovim / vscode / emacs のいずれかが入る。
# 受け取った後の処理はご自身で追加してください。
```

`source` が抽選と Firefox の片付けの完了まで待機します。
呼び出し元のシェルオプションや作業ディレクトリは変更しません。
`source` に実行権限の付与は不要です。

添付 `funny.sh` の `roulette()` 内には既に `source roulette.sh` があるので、
その行で自動実行され、直後から `$ROULETTE_RESULT` を参照できます。
30行目のコメント部分で再度起動する必要はありません。
`roulette()` 内で結果を `local` 宣言していないため、関数の呼び出し後も参照できます。
エディタのインストールや結果受信後の処理には変更を加えていません。
リポジトリ内の最小例は [examples/call-from-bash.sh](examples/call-from-bash.sh) です。

コマンド置換で受け取ることもできます：

```bash
ROULETTE_RESULT="$(bash /path/to/roulette/roulette.sh)"
```

成功時のみ標準出力に結果を1行出力します。Firefox のログやエラーは標準エラーです。
失敗時は非ゼロで終了し、`source` の場合は古い `ROULETTE_RESULT` も削除します。
`set -e` を使用しない呼び出し元では、`source ./roulette.sh` の終了ステータスを
確認してから結果を使用してください。

## Firefox の分離と終了

毎回ホームディレクトリ直下に `editor-roulette-*` という専用の一時プロファイルを
作成し、`--no-remote --new-instance --profile` で
別インスタンスとして Firefox を起動します。通常のプロファイルや既存のウィンドウには
接続しません。抽選結果を受信すると、この起動で作成したプロセスグループに限定して
終了させ、一時プロファイルとローカルサーバーを片付けてから Bash に結果を返します。
`pkill firefox` / `killall firefox` は使用しません。

結果の受け渡しは `127.0.0.1` の一時ポートを使用します。毎回生成するトークン、
接続先ホスト、送信元、4種類の結果を検証します。外部サーバーや外部ライブラリは不要です。
受信待ちは最大60秒です。早期終了、タイムアウト、Ctrl+C、SIGTERM の場合も
専用インスタンスの片付けを行い、結果を出力しません。
OS の強制終了や SIGKILL では片付け処理を実行できません。

## Web ページだけで使用する

`index.html` をブラウザーで開いても自動抽選します。
この場合は表示のみで、Bash への結果返却や Firefox の自動終了は行いません。
Bash との連携には必ず `roulette.sh` を使ってください。

## テスト

```bash
python3 -m unittest discover -s tests -v
node tests/test_wheel.cjs
bash -n roulette.sh examples/call-from-bash.sh tests/test_shell.sh
bash tests/test_shell.sh
```

Node.js はテストのみに必要です。
Python テストはローカルHTTP通信、全4結果、入力検証、正常終了・早期終了・
タイムアウト時の後片付け、出力契約を確認します。Firefox プロセスは代替オブジェクトで
検証します。JavaScript テストは17通りのアニメーションで初期角度、停止位置と結果の
一致、4種類の結果、1回だけの通知、静的ページでの動作を確認します。
Bash テストは source / コマンド実行による受け渡しと失敗時の状態を確認します。

この変更時には Windows 上で上記の自動テストを実行しました。
Linux の実 Firefox による描画・終了、既存 Firefox と同時起動した場合の分離、
Snap 版 Firefox の一時プロファイルへのアクセスは実機未確認です。
利用する Linux 環境では、通常の Firefox を開いた状態で `bash roulette.sh` を実行し、
抽選後に専用ウィンドウだけが閉じ、通常のウィンドウが残ることを確認してください。

## 元のプロジェクト

- [オリジナルのデモ](https://kubo-4ka.github.io/roulette/)
- [元の紹介記事](https://qiita.com/kubo4ka/items/2217105f2d2dbe4707ee)

上記のデモは元の作成者のバージョンです。このフォークの自動実行仕様とは異なります。
