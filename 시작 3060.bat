@echo off
chcp 65001
cd /d "%~dp0"
start http://localhost:3060
python -m http.server 3060 --directory public
