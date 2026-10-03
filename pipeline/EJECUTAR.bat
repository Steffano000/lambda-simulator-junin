@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Datos para la version mejorada

where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instala Python 3.12 desde https://www.python.org/downloads/
  echo y marca la casilla "Add python.exe to PATH". Luego vuelve a abrir este archivo.
  pause
  exit /b 1
)

echo === 1) Instalando librerias ===
python -m pip install --upgrade pip
python -m pip install earthengine-api requests
python -m pip install rasterio
echo.

echo === 2) Autenticacion con Earth Engine (solo la primera vez) ===
echo Se abrira el navegador: elige tu cuenta de Google y acepta los permisos.
python codigos\00_autenticar.py
if errorlevel 1 (
  echo La autenticacion fallo. Revisa el mensaje de arriba.
  pause
  exit /b 1
)
echo.

echo === 3) Descarga de datos de Junin (puede tardar horas; no cierres esta ventana) ===
python codigos\ejecutar_todo.py
echo.
pause
