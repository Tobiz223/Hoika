@echo off
chcp 65001 >nul
set "GAME=%~dp0index.html"
set "URL=file:///%GAME:\=/%"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" ( start "" "%CHROME%" --app="%URL%" --start-fullscreen --user-data-dir="%LOCALAPPDATA%\SteelFrontier" & exit /b )
if exist "%EDGE%" ( start "" "%EDGE%" --app="%URL%" --start-fullscreen --user-data-dir="%LOCALAPPDATA%\SteelFrontier" & exit /b )
start "" "%GAME%"
