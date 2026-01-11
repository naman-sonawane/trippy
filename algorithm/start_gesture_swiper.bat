@echo off
echo Starting Gesture Swiper for Trippy
echo ===================================
echo.

if "%~1"=="" (
    echo Usage: start_gesture_swiper.bat [user_id] [destination]
    echo Example: start_gesture_swiper.bat user_test Paris
    echo.
    set /p user_id="Enter User ID: "
    set /p destination="Enter Destination: "
) else (
    set user_id=%~1
    set destination=%~2
)

if "%destination%"=="" (
    echo Error: Both user_id and destination are required!
    pause
    exit /b 1
)

echo.
echo Starting gesture swiper for user '%user_id%' going to '%destination%'
echo.
echo Controls:
echo - Swipe LEFT with your hand to pass
echo - Swipe RIGHT with your hand to like
echo - Press 'q' to quit
echo.
pause

cd /d "%~dp0"
python gesture_server.py %user_id% %destination%

pause
