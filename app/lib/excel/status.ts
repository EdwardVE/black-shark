// lib/excel/status.ts
// Consulta a la Rama Judicial lo necesario para conocer el status de un radicado,
// pidiendo las actuaciones solo si el proceso se movió desde la última fecha
// registrada en la matriz.

import {
  ApiError,
  consultarActuaciones as consultarActuacionesApi,
  consultarRadicado as consultarRadicadoApi,
} from "../api/judicial";
import type { Pedir } from "../api/cola";
import type { DatosRama, ProcesoResumen } from "../tipos";

export interface DependenciasStatus {
  consultarRadicado: typeof consultarRadicadoApi;
  consultarActuaciones: typeof consultarActuacionesApi;
}

const DEPENDENCIAS_REALES: DependenciasStatus = {
  consultarRadicado: consultarRadicadoApi,
  consultarActuaciones: consultarActuacionesApi,
};

/** El proceso con la actuación más reciente (si hay varios por radicado). */
export function elegirPrincipal(procesos: ProcesoResumen[]): ProcesoResumen | null {
  return procesos.reduce<ProcesoResumen | null>((mejor, p) => {
    if (!mejor) return p;
    const a = p.fechaUltimaActuacion ?? "";
    const b = mejor.fechaUltimaActuacion ?? "";
    return a > b ? p : mejor;
  }, null);
}

/**
 * @param fechaRegistrada fecha más antigua entre las últimas fechas registradas
 *   para este radicado en la matriz (null si alguna fila no tiene fecha).
 */
export async function obtenerDatosRama(
  radicado: string,
  fechaRegistrada: string | null,
  pedir: Pedir,
  deps: DependenciasStatus = DEPENDENCIAS_REALES
): Promise<DatosRama> {
  let peticiones = 1;
  let procesos: ProcesoResumen[];
  try {
    procesos = await pedir((signal) => deps.consultarRadicado(radicado, { signal }));
  } catch (e) {
    if (e instanceof ApiError && e.tipo === "no_encontrado") {
      return {
        radicado,
        procesos: [],
        principal: null,
        actuaciones: null,
        error: { tipo: e.tipo, mensaje: e.message },
        peticiones,
      };
    }
    throw e; // la cola decide si pausar o marcar como no verificado
  }

  const principal = elegirPrincipal(procesos);
  const sinMovimiento =
    fechaRegistrada !== null &&
    principal?.fechaUltimaActuacion != null &&
    principal.fechaUltimaActuacion <= fechaRegistrada;

  if (!principal || principal.esPrivado || sinMovimiento) {
    return { radicado, procesos, principal, actuaciones: null, error: null, peticiones };
  }

  peticiones++;
  const actuaciones = await pedir((signal) =>
    deps.consultarActuaciones(principal.idProceso, { signal })
  );
  return { radicado, procesos, principal, actuaciones, error: null, peticiones };
}

/** DatosRama para un radicado que no se pudo consultar. */
export function datosConError(radicado: string, error: ApiError): DatosRama {
  const mensaje =
    error.tipo === "cancelado"
      ? "Consulta cancelada; se conserva el status anterior."
      : `No verificado hoy: ${error.message}`;
  return {
    radicado,
    procesos: [],
    principal: null,
    actuaciones: null,
    error: { tipo: error.tipo, mensaje },
    peticiones: 0,
  };
}
