A continuación se presenta la especificación y el desglose de requerimientos de bajo nivel a partir de las épicas propuestas. La estructura está diseñada para servir como base de arquitectura y desarrollo de software para un simulador web interactivo en entorno sandbox enfocado en la agricultura andina.
1. Módulo: Simulador por Grillas (Grid Engine 3D - Three.js)
EP-01.1: Inicialización, Estructura Logico-Espacial 3D y Renderizado con Three.js
Descripción: Definir la infraestructura de la grilla 3D basada en Three.js. Cada celda operará como un nodo en el espacio tridimensional (X,Y,Z), manteniendo la sincronización entre el estado lógico de simulación y las instancias o mallas (meshes) visuales en la escena.
Requerimientos Funcionales:
Parámetros de Grilla Espacial: El sistema debe inicializar la matriz lógica NM e instanciar en el plano XZ de Three.js el terreno base. La elevación (eje Y) estará determinada por el piso topográfico/altitud.
Atributos del Nodo 3D: Cada celda (TileNode) debe vincular su estado lógico (id, coordenadas, suelo, humedad, vegetacionId) con sus representaciones visuales:
meshTerrain: Instancia de la geometría/material de la tierra con representacion de colores segun tipo de tierra , con patrones de diseño como factory factory method y abstract factory, para poder reutilizar las creaciones de las tierras que mediran de 1mx1m en la grilla, tambien que cada bloque tenga una llamada a estados cuando se interactue con este para poder tener acciones de view data o alterar la data de ese terreno precisamente , , un ejemplo del tipo de4 suelos seria arenosos tierra , tierra arcillosa , entre otros.
meshPlant: Referencia o ID de instancia del modelo 3D del cultivo, estos dependientes de los tipos de cultivos solo tomando que cada cultivo tendra su diseño respectivo, por ejemplo papa, trigo , habas, los cuales seran influidos deacierdo a los estados del ambiente como seria temperatura. humedad , etc  .
position3D: Vector tridimensional THREE.Vector3(x, y, z), esto para poder ubiccar todo en sus respectivos espacios .

ejemplos de data : 
cultivo:
 {
   "nombre": "Papa",
   "cientifico": "Solanum tuberosum",
   "familia": "Solanaceae",
   "variedad": "INIA 303 Canchán",
   "ciclo_dias": 120,
   "dias_inicial": 23,
   "dias_desarrollo": 28,
   "dias_media": 42,
   "dias_final": 27,
   "kc_inicial": 0.5,
   "kc_medio": 1.15,
   "kc_final": 0.75,
   "raiz_m": 0.6,
   "p_agotamiento": 0.35,
   "t_base": 2,
   "t_superior": 26,
   "t_opt_min": 15,
   "t_opt_max": 25,
   "helada_letal": -1,
   "ph_opt_min": 5,
   "ph_opt_max": 6.2,
   "ph_abs_min": 4.2,
   "ph_abs_max": 8.5,
   "textura_preferida": "media, orgánica",
   "tolerancia_salinidad": "baja (<4 dS/m) / baja (<4)",
   "efecto_nitrogeno": "Extrae (alta demanda)",
   "mes_siembra": 10,
   "rendimiento_junin_2025": 21.78,
   "fuente_kc": "FAO-56 (semiárido)"
  },

clima por escenarios: 
 "Normal 2001-02": [
   {
    "mes": 1,
    "nombre": "Ene",
    "et0": 116.5,
    "lluvia": 74.4,
    "tmed": 10.9,
    "tmin": 7
   },
   {
    "mes": 2,
    "nombre": "Feb",
    "et0": 89.3,
    "lluvia": 140.5,
    "tmed": 10.3,
    "tmin": 7.1
   },
   {
    "mes": 3,
    "nombre": "Mar",
    "et0": 97.7,
    "lluvia": 115,
    "tmed": 10.2,
    "tmin": 7.2
   },
   {
    "mes": 4,
    "nombre": "Abr",
    "et0": 86.2,
    "lluvia": 52.1,
    "tmed": 9.9,
    "tmin": 6.5
   },
   {
    "mes": 5,
    "nombre": "May",
    "et0": 80.3,
    "lluvia": 18.7,
    "tmed": 9.2,
    "tmin": 4.8
   },
   {
    "mes": 6,
    "nombre": "Jun",
    "et0": 71,
    "lluvia": 9.6,
    "tmed": 8.4,
    "tmin": 4.1
   },
   {
    "mes": 7,
    "nombre": "Jul",
    "et0": 75.1,
    "lluvia": 28.4,
    "tmed": 7.5,
    "tmin": 3.2
   },
   {
    "mes": 8,
    "nombre": "Ago",
    "et0": 89.1,
    "lluvia": 18.2,
    "tmed": 8,
    "tmin": 3
   },
   {
    "mes": 9,
    "nombre": "Sep",
    "et0": 94.9,
    "lluvia": 47,
    "tmed": 9,
    "tmin": 5.2
   },
   {
    "mes": 10,
    "nombre": "Oct",
    "et0": 109.4,
    "lluvia": 68.7,
    "tmed": 9.9,
    "tmin": 6
   },
   {
    "mes": 11,
    "nombre": "Nov",
    "et0": 104.4,
    "lluvia": 75.8,
    "tmed": 10.8,
    "tmin": 7.1
   },
   {
    "mes": 12,
    "nombre": "Dic",
    "et0": 116.3,
    "lluvia": 87.3,
    "tmed": 10.7,
    "tmin": 6.3
   }
  ],
ciclos de cultivos: "Papa": {
   "mes_siembra": 10,
   "meses": [
    {
     "mes_ciclo": 1,
     "mes": 10,
     "nombre": "Oct",
     "dia_medio": 15.2,
     "etapa": "Inicial",
     "kc": 0.5,
     "fraccion_mes": 1,
     "escenarios": {
      "Promedio 1950–2026": {
       "et0": 108.4,
       "etc": 54.2,
       "lluvia": 66.7,
       "balance": 12.5
      },
      "Normal 2001-02": {
       "et0": 109.4,
       "etc": 54.7,
       "lluvia": 68.7,
       "balance": 14
      },
      "Seco / El Niño 2015-16": {
       "et0": 114.4,
       "etc": 57.2,
       "lluvia": 55.4,
       "balance": -1.8
      },
      "Lluvioso / La Niña 1988-89": {
       "et0": 109.3,
       "etc": 54.65,
       "lluvia": 71.8,
       "balance": 17.15
      },
      "Extremo seco 1991-92": {
       "et0": 102.8,
       "etc": 51.4,
       "lluvia": 68.3,
       "balance": 16.9
      }
     }
    },
    {
     "mes_ciclo": 2,
     "mes": 11,
     "nombre": "Nov",
     "dia_medio": 45.6,
     "etapa": "Desarrollo",
     "kc": 1.025,
     "fraccion_mes": 1,
     "escenarios": {
      "Promedio 1950–2026": {
       "et0": 107.4,
       "etc": 110.047,
       "lluvia": 73.7,
       "balance": -36.347
      },
      "Normal 2001-02": {
       "et0": 104.4,
       "etc": 106.973,
       "lluvia": 75.8,
       "balance": -31.173
      },
      "Seco / El Niño 2015-16": {
       "et0": 112.2,
       "etc": 114.965,
       "lluvia": 62.9,
       "balance": -52.065
      },
      "Lluvioso / La Niña 1988-89": {
       "et0": 103.1,
       "etc": 105.641,
       "lluvia": 75.5,
       "balance": -30.141
      },
      "Extremo seco 1991-92": {
       "et0": 106.4,
       "etc": 109.022,
       "lluvia": 60.4,
       "balance": -48.622
      }
     }
    },
    {
     "mes_ciclo": 3,
     "mes": 12,
     "nombre": "Dic",
     "dia_medio": 76,
     "etapa": "Media",
     "kc": 1.15,
     "fraccion_mes": 1,
     "escenarios": {
      "Promedio 1950–2026": {
       "et0": 107.6,
       "etc": 123.74,
       "lluvia": 95.5,
       "balance": -28.24
      },
      "Normal 2001-02": {
       "et0": 116.3,
       "etc": 133.745,
       "lluvia": 87.3,
       "balance": -46.445
      },
      "Seco / El Niño 2015-16": {
       "et0": 112.3,
       "etc": 129.145,
       "lluvia": 100.3,
       "balance": -28.845
      },
      "Lluvioso / La Niña 1988-89": {
       "et0": 100.5,
       "etc": 115.575,
       "lluvia": 113.1,
       "balance": -2.475
      },
      "Extremo seco 1991-92": {
       "et0": 120.9,
       "etc": 139.035,
       "lluvia": 61.7,
       "balance": -77.335
      }
     }
    },
    {
     "mes_ciclo": 4,
     "mes": 1,
     "nombre": "Ene",
     "dia_medio": 106.4,
     "etapa": "Final",
     "kc": 0.951,
     "fraccion_mes": 0.947,
     "escenarios": {
      "Promedio 1950–2026": {
       "et0": 98.621,
       "etc": 93.836,
       "lluvia": 111.695,
       "balance": 17.859
      },
      "Normal 2001-02": {
       "et0": 110.368,
       "etc": 105.014,
       "lluvia": 70.484,
       "balance": -34.529
      },
      "Seco / El Niño 2015-16": {
       "et0": 111.6,
       "etc": 106.185,
       "lluvia": 81.947,
       "balance": -24.238
      },
      "Lluvioso / La Niña 1988-89": {
       "et0": 92.747,
       "etc": 88.247,
       "lluvia": 136.8,
       "balance": 48.553
      },
      "Extremo seco 1991-92": {
       "et0": 108.947,
       "etc": 103.661,
       "lluvia": 51.632,
       "balance": -52.03
      }
     }
    }
   ],
   "total": {
    "Promedio 1950–2026": {
     "etc": 381.823,
     "lluvia": 347.595,
     "balance": -34.228
    },
    "Normal 2001-02": {
     "etc": 400.431,
     "lluvia": 302.284,
     "balance": -98.147
    },
    "Seco / El Niño 2015-16": {
     "etc": 407.495,
     "lluvia": 300.547,
     "balance": -106.948
    },
    "Lluvioso / La Niña 1988-89": {
     "etc": 364.113,
     "lluvia": 397.2,
     "balance": 33.087
    },
    "Extremo seco 1991-92": {
     "etc": 403.118,
     "lluvia": 242.032,
     "balance": -161.087
    }
   }
  },
\
terrenos:{
   "clase": "Arena",
   "clase_en": "Sand",
   "cc_min": 0.07,
   "cc_max": 0.17,
   "pmp_min": 0.02,
   "pmp_max": 0.07,
   "cc_media": 0.12,
   "pmp_media": 0.045,
   "agua_util_mm_m": 75,
   "rew_mm": "2–7",
   "tew_mm": "6–12"
  },


Gestión de Escena y Cámara: Implementar una cámara en perspectiva (THREE.PerspectiveCamera) con controles de órbita (OrbitControls) adaptados para vista isométrica o cenital tipo God-View/Sandbox, con límites de zoom y colisión con el plano base.
Entradas / Salidas:
Entrada: Dimensiones de la grilla (NM), HTMLCanvasElement objetivo, configuración de la cámara.
Salida: Escena de Three.js (THREE.Scene) con el render loop inicializado y la matriz de celdas instanciada.
EP-01.2: Gestión y Carga de Assets 3D Públicos (Asset Pipeline)
Descripción: Sistema de administración, precarga y reutilización de modelos 3D externos (formatos .gltf / .glb) provenientes de repositorios públicos o bibliotecas de modelos libres (p. ej., Poly Pizza, Kenney.nl, OpenGameArt).
Requerimientos Funcionales:
Cargador de Modelos: Implementar un servicio centralizado de carga utilizando GLTFLoader (y DRACOLoader para compresión de mallas) con soporte para promesas y callbacks de progreso.
Catálogo de Reutilización: Definir un registro estático que mapee los tipos de vegetación y terreno con sus respectivos assets 3D:
Vegetación: Modelos GLTF con variaciones de escala/etapa fenológica (ej. gltf/crops/potato_stage_1.glb, potato_stage_2.glb).
Terreno/Rocas: Modelos de bloques de tierra, rocas, canales de agua o parches de vegetación silvestre.
Normalización de Assets: El sistema debe aplicar transformaciones automáticas al cargar cualquier asset externo:
Ajuste de escala unitaria para encajar exactamente dentro del tamaño de celda configurado.
Reajuste de pivote al centro-inferior (base) del modelo para una alineación precisa sobre la superficie del terreno (Y=0 relativo a la celda).
Manejo de Errores y Fallbacks: Si un asset .glb falla durante la descarga o no existe, el sistema debe reemplazar la entidad por una geometría primitiva (ej. un cubo THREE.BoxGeometry o cilindro colorido) sin detener la ejecución de la aplicación.


2. Módulo: Generación Procedural del Mapa
EP-02.1: Generación de Topografía y Microclimas Andinos
Descripción: Algoritmo procedural para crear el relieve (altitud) y la distribución base del terreno reflejando las condiciones de la sierra andina.
Requerimientos Funcionales:
El sistema debe emplear ruido coherente (por ejemplo, Perlin Noise o Simplex Noise) alimentado por una semilla (seed) configurable.
El valor de altitud resultante debe mapearse a pisos ecológicos (ej. Yunga, Quechua, Suni, Puna) determinando la temperatura base y presión atmosférica de la celda.
Permitir la regeneración del mapa mediante el cambio de la semilla sin alterar la configuración del motor.
EP-02.2: Distribución Procedural de Suelos y Agua
Descripción: Algoritmo para asignar tipos de tierra e hidrografía inicial sobre la topografía generada.
Requerimientos Funcionales:
Clasificar celdas automáticas en función de la altitud y pendiente: lecho de río/vertiente, tierra fértil, suelo arcilloso, suelo rocoso, o helada/nieve.
Proporcionar una opción de exportación e importación del estado inicial del terreno en formato ligero.
3. Módulo: Gestión de Estados para Tipos de Tierra y Contexto Andino
EP-03.1: Dinámica Física del Suelo Andino
Descripción: Modelo de datos para gestionar la composición, pH, retención de agua y degradación de la tierra.
Requerimientos Funcionales:
Cada celda debe manejar el estado dinámico del suelo con las variables: N-P-K (Nitrógeno, Fósforo, Potasio), MateriaOrgánica,CapacidaddeRetencióndeAgua, pH (ácido, neutro, alcalino).
Soportar los siguientes tipos de tierra específicos de zona andina:
Tierra Negra/Fértil (Mollisol): Alta retención de nutrientes y humedad.
Tierra Arcillosa: Retención de agua alta pero bajo drenaje, propensa a anegamiento.
Tierra Arenosa/Serrana: Drenaje rápido, pérdida acelerada de nutrientes.
Tierra Franca: Equilibrio óptimo para cultivos como papa, quinua o maíz.
Implementar la regla de negocio: "A mayor pendiente y lluvia intensa, mayor tasa de erosión y pérdida de nutrientes en el suelo sin cobertura vegetal".
EP-03.2: Zonificación de Plantaciones y Restricciones de Cultivo
Descripción: Reglas de validación para permitir la siembra según las propiedades del suelo y la altitud.
Requerimientos Funcionales:
Validar si un tipo de cultivo (ej. Papa Nativa, Quinua, Kiwicha, Maíz) es compatible con la altitud (ms.n.m.) y temperatura media de la celda.
Impedir la siembra si el suelo no cumple los umbrales mínimos de nutrientes o si la humedad es insuficiente o excesiva.
4. Módulo: Retroalimentación de Estados de Vegetación con Datos Reales
EP-04.1: Modelo Fenológico de la Vegetación
Descripción: Gestor del ciclo de vida de los cultivos según variables agronómicas reales (fases: germinación, crecimiento vegetativo, floración, maduración, cosecha).
Requerimientos Funcionales:
Calcular en cada Tick la acumulación de Días Grado Desarrollo (GDD - Growing Degree Days) basados en la temperatura real o simulada de la celda.
Transicionar automáticamente el estado de la planta cuando se alcancen los umbrales térmicos configurados para la especie.
Si la temperatura cae por debajo del umbral crítico de helada (ej. $< 0^\circ\text{C}$) o supera el umbral de estrés térmico, aplicar daño porcentual a la salud de la planta (Crop Health Index).
EP-04.2: Consumo de Recursos y Evapotranspiración
Descripción: Simulación del consumo de agua y nutrientes por parte del cultivo y la evapotranspiración del entorno.
Requerimientos Funcionales:
La planta absorbe agua y nutrientes (N,P,K) de la celda en función de su etapa fenológica actual.
Si los recursos son insuficientes, reducir la tasa de crecimiento e incrementar el índice de estrés de la vegetación.
Ajustar el rendimiento de cosecha esperado (yield) en función de los acumulados de estrés hídrico y térmico sufridos durante el ciclo.
5. Módulo: Sistema de Gestión de Acciones según el Entorno
EP-05.1: Interacciones del Usuario sobre la Grilla (Herramientas)
Descripción: Permite la modificación directa del terreno y los cultivos mediante la selección e interacción con celdas.
Requerimientos Funcionales:
Implementar acciones de manipulación del suelo: Arar, Aportar Abono/Fertilizante, Regar, Instalar Canal de Riego, Cosechar, Remover Cultivo.
Cada acción debe requerir condiciones previas válidas (ej. No se puede arar una celda con un cultivo maduro sin antes cosechar).
Abonar debe incrementar los niveles de N-P-K o materia orgánica del suelo según el tipo de abono utilizado (orgánico/químico).
EP-05.2: Propagación de Efectos Ambientales
Descripción: Las acciones en una celda deben tener un impacto lógico en las celdas contiguas.
Requerimientos Funcionales:
Si se establece una celda de agua o canal de riego, se debe incrementar la humedad residual en un radio R de celdas adyacentes según el gradiente de pendiente.
La plaga o enfermedad en una vegetación debe tener un coeficiente de propagación probabilístico hacia las celdas vecinas si comparten el mismo tipo de cultivo (monocultivo).
6. Módulo: Gestión de Estaciones y Clima por Eventos JSON
EP-06.1: Parser y Motor de Eventos Climáticos JSON
Descripción: Sistema basado en archivos JSON para definir la secuencia cronológica de clima, estaciones y eventos hidrometeorológicos.
Requerimientos Funcionales:
Estructurar esquema JSON para soportar datos de: temperatura máxima/mínima, precipitación, humedad relativa, radiación solar y eventos extremos (heladas, granizadas, sequías).
El motor debe leer el archivo JSON y aplicar secuencialmente los valores climáticos globales a la simulación por cada ciclo de tiempo (día simulado).
Ejemplo de Esquema JSON:
JSON
{
  "estacion": "Invierno",
  "diaSimulado": 45,
  "climaGlobal": {
    "temperaturaAmbiente": 4.2,
    "precipitacionMm": 0.0,
    "humedadRelativaPct": 35,
    "vientoKmH": 18.5
  },
  "eventosEspeciales": [
    {
      "tipo": "HELADA_METEOROLOGICA",
      "intensidad": "SEVERA",
      "factorTemperatutaDelta": -6.5,
      "duracionTicks": 12
    }
  ]
}

EP-06.2: Inyección Dinámica de Anomalías Climáticas (El Niño / La Niña / Heladas)
Descripción: Carga de escenarios meteorológicos andinos representativos para evaluación de resiliencia agrícola.
Requerimientos Funcionales:
Permitir seleccionar perfiles preconfigurados vía JSON: "Año Normal", "Año FEN (Inundaciones/Lluvias intensas)", "Año Sequía Arequipa/Puno", "Heladas Temporales".
Al activarse un evento especial desde el JSON, recalcular los parámetros de la matriz de celdas afectados inmediatamente.
7. Módulo: Optimización y Manejo de Estructuras JSON
EP-07.1: Estructuración Ligera de Datos e Inmutabilidad
Descripción: Teniendo en cuenta la densidad de información de una grilla, se requiere optimizar la serialización y deserialización de archivos JSON.
Requerimientos Funcionales:
Implementar codificación por matriz plana o codificación RLE (Run-Length Encoding) para representar celdas contiguas con propiedades idénticas (evitando la redundancia clave-valor por celda).
Optimizar los nombres de propiedades en transmisión/persistencia (p. ej., x, y, t, h, n en lugar de nombres extensos).
Permitir la compresión del JSON mediante algoritmos nativos web (ej. Gzip/Deflate vía Streams API) antes de su transmisión o almacenamiento local.
EP-07.2: Carga Progresiva y Parsing Asíncrono
Descripción: Evitar el congelamiento del hilo principal (main thread) de la aplicación web durante la carga de mapas o eventos JSON pesados.
Requerimientos Funcionales:
El parsing de JSONs superiores a 5MB debe ser procesado fuera del hilo principal usando Web Workers.
Notificar el progreso de carga a la interfaz web mediante barras de estado porcentuales.
8. Módulo: Generación de Casos Estáticos y Presets
EP-08.1: Escenarios Preconfigurados de Prueba (Benchmarks)
Descripción: Proporcionar mapas estáticos previamente diseñados para pruebas de concepto, validación académica o demostraciones.
Requerimientos Funcionales:
El sistema debe incluir al menos tres casos estáticos predeterminados:
Caso A - Valle Interandino: Suelos fértiles, clima templado, cultivo recomendado: Maíz / Papa.
Caso B - Altiplano / Puna: Alta radiación, bajas temperaturas, riesgo de helada, cultivo: Quinua / Cañihua.
Caso C - Ladera / Terraza: Pendiente pronunciada, requerimiento de andenería, alta erosión sin control.
Los escenarios estáticos deben incluir posiciones de suelo, clima y cultivos pre-sembrados con parámetros fijos.
9. Módulo: Requerimientos de Estados Tipo Sandbox (Modo Experimento)
EP-09.1: Panel de Control de Variables Ambientales en Tiempo Real
Descripción: Interfaz de simulación abierta para alterar manualmente las variables del entorno sin depender de la secuencia programada.
Requerimientos Funcionales:
Proporcionar sliders y controles numéricos en la interfaz web para modificar dinámicamente:
Temperatura ambiente actual.
Tasa de lluvia (mm/h).
Nivel de radiación solar.
Incidencia de plagas.
Opción de "Pausa", "Aceleración del tiempo" (1x,5x,20x) y "Rebobinado/Reset" del estado de la simulación.
EP-09.2: Inspección y Edición Directa de Celdas
Descripción: Modo de inspección profunda (Inspector Tool) para depurar o forzar estados en cualquier celda individual.
Requerimientos Funcionales:
Al hacer clic en una celda en modo Sandbox, desplegar un panel lateral con todos los valores internos del suelo y la vegetación.
Permitir la modificación directa de cualquier variable (ej. Forzar humedad al $100\%$, alterar pH a 5.5, eliminar plaga) y observar el impacto en los siguientes Ticks.
Permitir exportar el estado actual del Sandbox como un nuevo archivo JSON de caso de estudio.



