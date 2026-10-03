@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Exportar todos los datos a JSON para la app
echo === 1) Librerias ===
python -m pip install numpy pandas rasterio
echo.
echo === 2) Convertir la carpeta datos a JSON (public\data\junin) ===
echo Si los datos no estan en C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos,
echo define antes la variable LAMBDA_DATOS con la ruta correcta.
python codigos\17_exportar_json.py
echo.
echo Terminado. Revisa public\data\junin\manifest.json
pause
