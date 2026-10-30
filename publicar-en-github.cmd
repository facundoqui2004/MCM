@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  Subiendo Mindmap Studio a GitHub
echo  Repo: https://github.com/facundoqui2004/MCM
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git no esta instalado. Descargalo de https://git-scm.com/download/win
  echo [ERROR] git-no-instalado> publicar.log
  pause
  exit /b 1
)

if not exist .git (
  git init -b main
)

rem Estos archivos auxiliares no van al repositorio
findstr /x "publicar-en-github.cmd" .git\info\exclude >nul 2>nul || (
  echo publicar-en-github.cmd>> .git\info\exclude
  echo publicar.log>> .git\info\exclude
  echo commit-msg.txt>> .git\info\exclude
)

rem Si git no tiene nombre/email configurados, se usan los de la cuenta solo para este repo
git config user.name >nul 2>nul || git config user.name "facundoqui2004"
git config user.email >nul 2>nul || git config user.email "facundoq654@gmail.com"

git add -A
git diff --cached --quiet || git commit -F commit-msg.txt
git branch -M main

git remote remove origin >nul 2>nul
git remote add origin https://github.com/facundoqui2004/MCM.git

echo.
echo Subiendo... si aparece una ventana de GitHub, inicia sesion y autoriza.
git push -u origin main
set PUSH_RESULT=%errorlevel%

rem Registro para verificar el resultado
(
  echo push_exit=%PUSH_RESULT%
  git log --oneline -1
  git status -sb
  git remote -v
  git ls-files | find /c /v ""
) > publicar.log 2>&1

echo.
if "%PUSH_RESULT%"=="0" (
  echo LISTO: el codigo esta en https://github.com/facundoqui2004/MCM
) else (
  echo [ERROR] No se pudo subir. Revisa el mensaje de arriba.
)
echo.
pause
