@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Datos - calibracion con PISCO
echo === Calibracion de la lluvia con PISCOp v3.0 + ET0 y clima mensual ===
python codigos\09_pisco_calibracion.py
echo.
echo Terminado. Avisale a Claude para revisar los resultados.
pause
