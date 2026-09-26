/** Importar escenarios (archivo o JSON pegado) y exportar los personalizados en formato clima_escenarios. */
import { useState } from 'react';
import { useControllers } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { descargarJson } from './download';

const EJEMPLO = `{
  "clima_escenarios": {
    "Mi escenario": [
      { "mes": 1, "nombre": "Ene", "et0": 104, "lluvia": 118, "tmed": 10.2, "tmin": 6.8 },
      "… 12 meses …"
    ]
  }
}`;

export function ImportExport() {
  const { climate } = useControllers();
  const personalizados = useSimStore((s) => s.personalizados);
  const [texto, setTexto] = useState('');

  const leerArchivo = async (archivo: File | undefined) => {
    if (archivo) setTexto(await archivo.text());
  };

  return (
    <div className="space-y-2">
      <p className="text-2xs text-ui-ink-muted">
        Formato de <code>data/clima_escenarios.json</code>: 12 meses con <code>et0</code>, <code>lluvia</code>
        , <code>tmed</code> y <code>tmin</code>. También acepta una lista de 12 meses sola.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        onChange={(e) => leerArchivo(e.target.files?.[0])}
        className="block w-full text-2xs text-ui-ink-muted file:mr-2 file:rounded-md file:border file:border-ui-border file:bg-ui-panel file:px-2 file:py-1 file:text-2xs file:text-ui-ink"
        aria-label="Archivo JSON de escenarios"
      />
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={EJEMPLO}
        rows={6}
        className="field value resize-y text-2xs"
        aria-label="JSON de escenarios"
      />
      <div className="flex flex-wrap gap-1">
        <button
          className="btn btn-active"
          disabled={!texto.trim()}
          onClick={() => {
            climate.importar(texto);
            setTexto('');
          }}
        >
          Importar
        </button>
        <button
          className="btn"
          disabled={personalizados.length === 0}
          onClick={() =>
            descargarJson(
              climate.exportar(personalizados.map((p) => p.nombre)),
              'clima_escenarios-personalizados.json',
            )
          }
        >
          Exportar personalizados ({personalizados.length})
        </button>
      </div>
    </div>
  );
}
