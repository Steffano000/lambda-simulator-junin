@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Datos - uso del suelo y areas protegidas

echo === Uso del suelo (WorldCover, Dynamic World) y areas protegidas de Junin ===
python codigos\10_uso_suelo.py
echo.
echo Terminado. Avisale a Claude para revisar los resultados.
pause
