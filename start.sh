#!/usr/bin/env sh
# Starts the local server on 127.0.0.1:8384. Open the printed URL in Chrome or Edge.
# Usage: ./start.sh        (app)
#        PORT=9000 ./start.sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js 18 or newer is required: https://nodejs.org"; exit 1; }
exec node serve.mjs
