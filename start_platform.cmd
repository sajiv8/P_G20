@echo off
title CampusRSO Platform
echo ===================================================
echo Starting CampusRSO Platform (Frontend and Backend)
echo ===================================================
echo.
echo Servers are starting up... 
echo The browser will open automatically in a few seconds.
echo.

:: Start a background task to delay and then open the browser
start /b cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:5173"

:: Run the dev server
call npm run dev

echo.
echo Process terminated.
pause
