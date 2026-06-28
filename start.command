#!/bin/bash
cd /Users/tommie/Desktop/phm
PORT=5173
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    open "http://localhost:$PORT"
    exit 0
fi
python3 -m http.server $PORT &
sleep 1
open "http://localhost:$PORT"
wait
