@echo off
REM =======================================
REM  Airi Browser Bridge Server
REM =======================================
echo Starting Airi Browser Bridge Server...
echo.
echo This server connects AIRI to the browser-bridge Chrome extension.
echo Make sure the browser-bridge extension is loaded in Chrome.
echo.
node browser-bridge\server.mjs
pause