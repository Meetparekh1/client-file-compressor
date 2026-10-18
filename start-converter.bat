@echo off
echo Starting DocuKit Adobe PDF Services Backend on http://localhost:7860...
cd converter-service
py -m uvicorn main:app --host 127.0.0.1 --port 7860 --reload
pause
