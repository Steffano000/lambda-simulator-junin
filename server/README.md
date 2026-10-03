# Servidor Fase 2 (opcional)

Lee los GeoTIFF de la carpeta `datos` a 30 m para la parcela dibujada.

```
python -m pip install -r requirements.txt
set LAMBDA_DATOS=C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos
uvicorn main:app --reload
```

Luego crea `.env.local` en la raíz del repo con `VITE_API_URL=http://127.0.0.1:8000` y vuelve a correr `npm run dev`.
Documentación automática en http://127.0.0.1:8000/docs.
