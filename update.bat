@echo off
echo ========================================================
echo   Auto-Updating GitHub & Triggering Live Web Deploy
echo ========================================================
echo.
set /p msg="Enter update description (e.g. Added new feature): "
if "%msg%"=="" set msg=Update project

echo.
echo [1/3] Staging modified files...
git add .

echo [2/3] Committing changes...
git commit -m "%msg%"

echo [3/3] Pushing to GitHub...
git push origin main

echo.
echo ========================================================
echo   Done! Your live website is now automatically updating!
echo ========================================================
pause
