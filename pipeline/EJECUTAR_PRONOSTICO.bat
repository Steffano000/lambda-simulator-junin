@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Pronostico SARIMAX, balance hidrico y AquaCrop
echo === 1) Librerias (statsmodels, AquaCrop) ===
python -m pip install statsmodels pandas aquacrop
echo.
echo === 2) Pronostico SARIMAX con escenarios ENSO (unos 5 minutos) ===
python codigos\13_pronostico_sarimax.py
echo.
echo === 3) Balance hidrico FAO-56 por cultivo y escenario ===
python codigos\14_balance_hidrico.py
echo.
echo === 4) AquaCrop por escenario (unos 5-10 minutos) ===
python codigos\15_aquacrop_escenarios.py
echo.
echo === 5) JSON para la app (public\data\junin del repositorio) ===
python codigos\16_exportar_para_app.py
echo.
echo Terminado. Avisale a Claude para revisar los resultados.
pause
