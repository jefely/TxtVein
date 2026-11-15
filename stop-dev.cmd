@echo off
setlocal
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8899" ^| findstr "LISTENING"') do (
  echo stopping TxtVein dev server PID %%a
  taskkill /PID %%a /F >nul 2>&1
)
echo done.
