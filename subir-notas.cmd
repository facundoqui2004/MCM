@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === 1/3 Instalando la libreria nueva (@floating-ui/react) ===
call npm install
if errorlevel 1 goto error
echo.
echo === 2/3 Guardando los cambios en git ===
git add -A -- . ":(exclude)subir-notas.cmd"
git commit -m "Notas por idea con vista previa estilo Obsidian" -m "Vista previa al pasar el cursor sobre ideas con nota, ventana fijada editable (clic o Ctrl Enter), marca de nota en los nodos y busqueda dentro de las notas." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01QtucjsWvU2vGiHAAeWgctD"
echo.
echo === 3/3 Subiendo a GitHub (Vercel publica solo) ===
git push -u origin main
if errorlevel 1 goto error
echo.
echo Listo. En un par de minutos se ve en https://mcm-xi.vercel.app
pause
(goto) 2>nul & del "%~f0"
:error
echo.
echo Algo fallo. Copia o saca una captura de lo de arriba y mandamela.
pause
