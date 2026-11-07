@echo off
chcp 65001 >nul
title FAST HANDS - servidor
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Baixe em https://nodejs.org  (botao LTS), instale e abra este arquivo de novo.
  echo.
  start https://nodejs.org
  pause
  exit /b
)
echo.
echo  Para jogar no CELULAR na mesma rede Wi-Fi, use um destes enderecos:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo     http://%%a:3000
echo.
start "" http://localhost:3000
node server.js
pause
