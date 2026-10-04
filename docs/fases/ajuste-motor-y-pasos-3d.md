# Ajuste · Pasos 8-12 en el 3D y motores que cuadran

## Qué cambió

- **El mapa termina en el paso 7** (escenario climático) con el botón «Abrir la parcela en 3D». Cultivo, condiciones de plantación, motor de Junín y rotación (pasos 8-12) están en el simulador 3D (fase «Cultivos»; la rotación, en «Cosecha»). El cultivo es el que se elige en el 3D, así que la cifra que se ve es la misma que se cosecha.
- **Solo los 5 cultivos del 3D** (papa, maíz amiláceo, quinua, haba, avena forrajera): son los únicos con fenología, Kc y balance hídrico. Los otros 40 del catálogo solo tienen rendimiento DRA y rangos EcoCrop.
- **Balance FAO-56 como anomalía**: rendimiento = DRA 2022 × (factor de agua del escenario ÷ factor de agua del clima normal) × rotación. El DRA ya es lo que se cosechó con la lluvia real; antes se descontaba la sequía «normal» dos veces (papa en Huayao: 17.67 → 22.37 t/ha; AquaCrop da 23.30, ahora a 4 %). AquaCrop queda plegado como «Validación».
- **Error corregido**: la aptitud EcoCrop solo escala a los cultivos que no se siembran en la provincia (maíz choclo en Concepción daba 0.01 t/ha; ahora el DRA de la provincia).
- **Parcela real en 3D**: se ofrecen los 5 cultivos aunque la textura no sea la preferida (es una advertencia de las condiciones de plantación). Cambiar escenario, campaña o cultivo anterior en el 3D actualiza el clima y el rendimiento de cada celda sin borrar el terreno.
- En «Resolución efectiva» el clima ya no muestra «×2000».

## Pendiente

- Precios de compra de semilla y de venta por saco o kg: fase final.
- Los requisitos de siembra del 3D (p. ej. pH ≤ 6.2 para papa) siguen pidiendo tratar el suelo antes de sembrar; en las condiciones de plantación ese pH es solo una advertencia.
