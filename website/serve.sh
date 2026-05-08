#!/bin/bash
# Serve the built site on the Tailscale network
# Access from any device on your tailnet at http://enge:4173

cd "$(dirname "$0")"
echo "Building site..."
npm run build

echo ""
echo "==================================="
echo "  PURSUE UAP Document Explorer"
echo "==================================="
echo "  Local:    http://localhost:4173"
echo "  Tailnet:  http://enge:4173"
echo "  IP:       http://100.111.185.11:4173"
echo "==================================="
echo ""

npm run preview
