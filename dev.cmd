@echo off
cd /d "%~dp0"
echo.
echo  TxtVein local dev server
echo  -----------------------
echo  edit index.html / css / js  -^>  press F5 in the browser
echo  edit js/                    -^>  no build needed for index.html
echo  edit single file           -^>  node tools/build.cjs
echo.
echo  DevTools: F12   localStorage key: txtvein:v2:vault
echo.
python serve.py 8899
