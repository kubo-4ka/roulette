#!/usr/bin/env python3
"""Linux Firefox launcher. stdout is reserved for one successful result."""
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

ITEMS = ("vim", "neovim", "vscode", "emacs")
ROOT = Path(__file__).resolve().parent


class LocalServer(HTTPServer):
    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(1)
        return connection, address


def make_server(token):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def reply(self, status, body=b"", content_type="text/plain"):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def valid_host(self):
            return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

        def do_GET(self):
            files = {"/": ("index.html", "text/html; charset=utf-8"),
                     "/script.js": ("script.js", "text/javascript; charset=utf-8"),
                     "/style.css": ("style.css", "text/css; charset=utf-8")}
            if not self.valid_host() or self.path not in files:
                self.reply(404)
                return
            name, content_type = files[self.path]
            self.reply(200, (ROOT / name).read_bytes(), content_type)

        def do_POST(self):
            origin = f"http://127.0.0.1:{self.server.server_port}"
            if (not self.valid_host() or self.path != "/result"
                    or self.headers.get("Origin") != origin):
                self.reply(403)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 1024:
                    raise ValueError("Invalid length")
                data = json.loads(self.rfile.read(size))
                if (not isinstance(data, dict) or data.get("token") != token
                        or data.get("result") not in ITEMS):
                    raise ValueError("Invalid result")
            except (ValueError, TypeError):
                self.reply(400)
                return
            if self.server.result is not None:
                self.reply(409)
                return
            self.server.result = data["result"]
            self.reply(200, b"OK")

    server = LocalServer(("127.0.0.1", 0), Handler)
    server.result = None
    server.timeout = 0.2
    return server


def close_firefox(process):
    # start_new_session=True で生成した、この実行専用のグループだけを終了。
    # killall/pkill や通常プロファイルへのリモート操作は使用しない。
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def run(timeout=60):
    if not sys.platform.startswith("linux"):
        raise RuntimeError("Bash / Python 3 / Firefox のある Linux デスクトップで実行してください")
    firefox = shutil.which("firefox")
    if not firefox:
        raise RuntimeError("firefox が PATH に見つかりません")
    token = secrets.token_urlsafe(32)
    # Snap 版 Firefox とホストで /tmp が異なる場合にも読める場所を使う。
    with tempfile.TemporaryDirectory(prefix="editor-roulette-", dir=Path.home()) as profile:
        with make_server(token) as server:
            url = f"http://127.0.0.1:{server.server_port}/#token={token}"
            process = subprocess.Popen(
                [firefox, "--no-remote", "--new-instance", "--profile", profile, url],
                stdout=sys.stderr, stderr=sys.stderr, start_new_session=True)
            try:
                deadline = time.monotonic() + timeout
                while server.result is None:
                    if process.poll() is not None:
                        raise RuntimeError("結果を受け取る前に Firefox が終了しました")
                    if time.monotonic() >= deadline:
                        raise RuntimeError("抽選結果の受信がタイムアウトしました")
                    server.handle_request()
                result = server.result
            finally:
                close_firefox(process)
    return result


def interrupted(_signum, _frame):
    raise KeyboardInterrupt


def main():
    signal.signal(signal.SIGTERM, interrupted)
    try:
        result = run()
    except KeyboardInterrupt:
        print("roulette: 中断しました", file=sys.stderr)
        return 130
    except (OSError, RuntimeError) as error:
        print(f"roulette: {error}", file=sys.stderr)
        return 1
    print(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
