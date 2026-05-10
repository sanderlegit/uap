#!/usr/bin/env python3
"""Local HTTP server that receives files POSTed from Safari and saves them."""

import os
import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

UFO_DIR = "/Users/sander/dev/illuminate/uap/ufo-files"

class FileReceiver(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        filename = self.headers.get('X-Filename', 'unknown')
        category = self.headers.get('X-Category', 'pdfs')

        dest_dir = os.path.join(UFO_DIR, category)
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, filename)

        body = self.rfile.read(content_length)

        with open(dest_path, 'wb') as f:
            f.write(body)

        print(f"Saved: {category}/{filename} ({len(body)} bytes)", file=sys.stderr)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "size": len(body)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Category')
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    for d in ["pdfs", "videos", "images"]:
        os.makedirs(os.path.join(UFO_DIR, d), exist_ok=True)
    server = HTTPServer(('127.0.0.1', 9876), FileReceiver)
    print("File receiver listening on http://127.0.0.1:9876", file=sys.stderr)
    server.serve_forever()
