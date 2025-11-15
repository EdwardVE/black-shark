// lib/api/judicial.ts

/**
 * Función para consultar un proceso en la API de la Rama Judicial.
 * @param processNumber El número de radicación del proceso.
 * @returns Promesa con los datos del proceso (o el error en JSON/Texto).
 */
export async function queryJudicialProcess(
  processNumber: string
): Promise<any> {
  const url = `https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta/NumeroRadicacion?numero=${processNumber}&SoloActivos=false&pagina=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error HTTP ${response.status}: ${errorText || response.statusText}`
    );
  }

  const data = await response.json();

  if (data && data.cantidadRegistros === 0) {
    throw new Error(
      `No se encontró ningún proceso con el número de radicación: ${processNumber}.`
    );
  }

  return data;
}
