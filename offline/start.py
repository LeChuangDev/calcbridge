#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""calcbridge 离线版启动器：在本机启动静态服务并打开浏览器。

用法：
    python start.py                 启动并自动打开浏览器
    python start.py --no-browser    只启动服务，不打开浏览器
    python start.py --port 9000     指定端口（默认自动从 8787 开始找空闲端口）

仅依赖 Python 3.8+ 标准库，不访问外网，数据只保存在本机浏览器里。
"""
import argparse
import http.server
import os
import socket
import socketserver
import threading
import webbrowser
from functools import partial

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")


def pick_port(start: int) -> int:
    """从 start 开始找一个空闲端口。"""
    for port in range(start, start + 50):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    raise SystemExit("找不到可用端口，请用 --port 指定一个。")


class Handler(http.server.SimpleHTTPRequestHandler):
    """静态文件服务；未知页面回退到 index.html（应用使用 hash 路由）。"""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        target = self.translate_path(self.path)
        if not os.path.exists(target) and not self.path.startswith("/assets/"):
            if os.path.exists(os.path.join(APP_DIR, "index.html")):
                self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="calcbridge 离线版启动器")
    parser.add_argument("--port", type=int, default=0, help="服务端口，默认自动选择")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    if not os.path.isdir(APP_DIR):
        raise SystemExit("缺少 app 目录，请先运行：npm run build:offline")

    port = args.port or pick_port(8787)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    handler = partial(Handler, directory=APP_DIR)

    with socketserver.ThreadingTCPServer(("127.0.0.1", port), handler) as httpd:
        httpd.daemon_threads = True
        url = f"http://127.0.0.1:{port}/"
        print(f"calcbridge 离线版已启动：{url}")
        print("按 Ctrl+C 停止服务。")
        if not args.no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


if __name__ == "__main__":
    main()
