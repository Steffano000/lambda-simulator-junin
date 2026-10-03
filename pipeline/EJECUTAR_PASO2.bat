@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Datos - segunda parte (PISCO, viento, NDVI)

echo === 1) Librerias para leer PISCO (NetCDF) ===
python -m pip install xarray netCDF4
echo.

echo === 2) Reintento de los meses de NDVI que fallaron ===
python codigos\05_ndvi_sentinel2.py
echo.

echo === 3) Viento horario ERA5-Land en los puntos (corrige la ET0) ===
python codigos\02b_viento_horario.py
echo.

echo === 4) Calibracion de la lluvia con PISCOp v3.0 + ET0 y clima mensual ===
python codigos\09_pisco_calibracion.py
echo.
echo Terminado. Avisale a Claude para revisar los resultados.
pause
