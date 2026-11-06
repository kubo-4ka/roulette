import contextlib
import http.client
import io
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import roulette


def request(server, method, path, body=None, origin=True):
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
    headers = {}
    if origin:
        headers["Origin"] = f"http://127.0.0.1:{server.server_port}"
    connection.request(method, path, body, headers)
    response = connection.getresponse()
    status, content = response.status, response.read()
    connection.close()
    return status, content


class BridgeTests(unittest.TestCase):
    def setUp(self):
        # テスト用プロファイルも作業コピー内だけに作成する。
        self.home_patch = patch.object(roulette.Path, "home", return_value=roulette.ROOT / "tests")
        self.home_patch.start()
        self.addCleanup(self.home_patch.stop)

    def test_http_validation_and_static_allowlist(self):
        with roulette.make_server("secret") as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                self.assertEqual(request(server, "GET", "/")[0], 200)
                self.assertEqual(request(server, "GET", "/roulette.py")[0], 404)
                self.assertEqual(request(server, "GET", "/../README.md")[0], 404)
                payload = json.dumps({"token": "secret", "result": "vim"})
                self.assertEqual(request(server, "POST", "/result", payload, False)[0], 403)
                for body in ('{', '[]', '{"token":"wrong","result":"vim"}',
                             '{"token":"secret","result":"other"}', 'x' * 1025):
                    self.assertEqual(request(server, "POST", "/result", body)[0], 400)
                    self.assertIsNone(server.result)
                self.assertEqual(request(server, "POST", "/result", payload)[0], 200)
                self.assertEqual(server.result, "vim")
                self.assertEqual(request(server, "POST", "/result", payload)[0], 409)
            finally:
                server.shutdown()
                worker.join()

    def test_run_delivers_each_choice_and_owns_profile(self):
        for choice in roulette.ITEMS:
            process = Mock(pid=12345)
            process.poll.return_value = None
            threads = []
            profiles = []

            def launch(arguments, **kwargs):
                from urllib.parse import urlparse, parse_qs
                url = urlparse(arguments[-1])
                token = parse_qs(url.fragment)["token"][0]
                profiles.append(Path(arguments[arguments.index("--profile") + 1]))
                self.assertTrue(profiles[-1].is_dir())
                self.assertIn("--no-remote", arguments)
                self.assertIn("--new-instance", arguments)
                self.assertTrue(kwargs["start_new_session"])
                def deliver():
                    connection = http.client.HTTPConnection("127.0.0.1", url.port, timeout=3)
                    connection.request("POST", "/result", json.dumps({"token": token, "result": choice}),
                                       {"Origin": f"http://127.0.0.1:{url.port}"})
                    self.assertEqual(connection.getresponse().status, 200)
                    connection.close()
                thread = threading.Thread(target=deliver)
                thread.start()
                threads.append(thread)
                return process

            with patch.object(roulette.sys, "platform", "linux"), \
                 patch.object(roulette.shutil, "which", return_value="/usr/bin/firefox"), \
                 patch.object(roulette.subprocess, "Popen", side_effect=launch), \
                 patch.object(roulette, "close_firefox") as close:
                self.assertEqual(roulette.run(timeout=3), choice)
                close.assert_called_once_with(process)
            for thread in threads:
                thread.join()
            self.assertFalse(profiles[0].exists())

    def test_failure_paths_cleanup(self):
        for exit_code, timeout, message in ((1, 60, "Firefox"), (None, 0, "タイムアウト")):
            process = Mock()
            process.poll.return_value = exit_code
            with patch.object(roulette.sys, "platform", "linux"), \
                 patch.object(roulette.shutil, "which", return_value="firefox"), \
                 patch.object(roulette.subprocess, "Popen", return_value=process), \
                 patch.object(roulette, "close_firefox") as close:
                with self.assertRaisesRegex(RuntimeError, message):
                    roulette.run(timeout=timeout)
                close.assert_called_once_with(process)

    def test_cleanup_targets_only_owned_group(self):
        process = Mock(pid=9876)
        with patch.object(roulette.os, "killpg", create=True) as kill, \
             patch.object(roulette.signal, "SIGKILL", 9, create=True):
            roulette.close_firefox(process)
            self.assertEqual([call.args[0] for call in kill.call_args_list], [9876, 9876])
            process.wait.assert_called()

    def test_cli_stdout_contract(self):
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(roulette, "run", return_value="neovim"), \
             contextlib.redirect_stdout(output):
            self.assertEqual(roulette.main(), 0)
        self.assertEqual(output.getvalue(), "neovim\n")
        output = io.StringIO()
        with patch.object(roulette, "run", side_effect=RuntimeError("failed")), \
             contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
            self.assertEqual(roulette.main(), 1)
        self.assertEqual(output.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
