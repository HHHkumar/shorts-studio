@echo off
rem Double-click to start the studio: quiz shorts, History and News, the
rem Kannada alphabet - one program. The browser opens by itself. Keep this
rem window open while you work; close it to stop the studio.
title Video Studio
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing the packages, this takes a minute...
  call npm install
)
call npm start
pause
