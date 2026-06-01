#!/bin/sh
# Start face indexing worker in background (PYTHONPATH ensures 'app' module is found)
PYTHONPATH=/app python /app/worker/face_worker.py &

# Start API server as PID 1 (receives Docker stop signals)
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
