#!/bin/sh
# Start face indexing worker in background
python /app/worker/face_worker.py &

# Start API server as PID 1 (receives Docker stop signals)
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
