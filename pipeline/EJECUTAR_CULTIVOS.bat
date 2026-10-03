@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Datos - estadistica agricola DRA Junin
echo === Descargando estadisticas agricolas por provincia (DRA Junin) ===
python codigos\11_descargar_estadistica_dra.py
echo.
echo Terminado. Avisale a Claude para armar el catalogo de cultivos.
pause
