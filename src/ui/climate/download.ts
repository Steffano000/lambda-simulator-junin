/** Descarga un texto JSON como archivo (acción de la vista; el contenido lo produce el controlador). */
export function descargarJson(contenido: string, archivo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.replace(/[\\/:*?"<>|]+/g, '-');
  a.click();
  URL.revokeObjectURL(url);
}
