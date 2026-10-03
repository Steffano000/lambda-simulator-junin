/** Cambia entre el geovisor/simulador de Junín y el simulador 3D de parcela. */
import { juninController } from '@/controllers/JuninController';
import { useJuninStore } from '@/store/juninStore';

export function ModoSwitch() {
  const modo = useJuninStore((s) => s.modo);
  return (
    <div role="group" aria-label="Modo" className="flex items-center gap-1">
      <button
        className={`btn ${modo === 'junin' ? 'btn-active' : ''}`}
        aria-pressed={modo === 'junin'}
        onClick={() => juninController.setModo('junin')}
      >
        Mapa Junín
      </button>
      <button
        className={`btn ${modo === 'simulador' ? 'btn-active' : ''}`}
        aria-pressed={modo === 'simulador'}
        onClick={() => juninController.setModo('simulador')}
      >
        Parcela 3D
      </button>
    </div>
  );
}
