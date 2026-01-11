@echo off
echo Starting Gesture Tracking Server...
cd /d "%~dp0"
python gesture_server.py
pause
