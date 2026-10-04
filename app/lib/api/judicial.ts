// lib/api/judicial.ts
// Cliente de la API pública de la Rama Judicial (consultaprocesos.ramajudicial.gov.co).
// Cada petición tiene timeout y sus errores se clasifican en reintentables o no.

import type { Actuacion, ProcesoResumen } from "../tipos";

const BASE = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2";

export type TipoError =
  | "timeout"
  | "red"
  | "http"
  | "no_encontrado"
  | "respuesta_invalida"
  | "cancelado";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly tipo: TipoError,
    readonly reintentable: boolean,
    readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface OpcionesPeticion {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

// --- Respuestas crudas de la API (solo los campos que usamos) ---

interface ApiProceso {
  idProceso: number;
  llaveProceso: string;
  fechaProceso: string | null;
  fechaUltimaActuacion: string | null;
  despacho: string | null;
  departamento: string | null;
  sujetosProcesales: string | null;
  esPrivado: boolean;
}

interface ApiRespuestaProcesos {
  procesos?: ApiProceso[];
  paginacion?: { cantidadRegistros: number };
}

interface ApiActuacion {
  consActuacion: number;
  fechaActuacion: string | null;
  actuacion: string | null;
  anotacion: string | null;
}

interface ApiRespuestaActuaciones {
  actuaciones?: ApiActuacion[];
}

const soloFecha = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : null;

const limpiar = (s: string | null | undefined) =>
  (s ?? "").replace(/\s+/g, " ").trim();

async function pedirJson<T>(
  url: string,
  { signal, timeoutMs = 20000, fetchImpl = fetch }: OpcionesPeticion
): Promise<T> {
  if (signal?.aborted) throw new ApiError("Consulta cancelada", "cancelado", false);

  const control = new AbortController();
  let porTimeout = false;
  const timer = setTimeout(() => {
    porTimeout = true;
    control.abort();
  }, timeoutMs);
  const alCancelar = () => control.abort();
  signal?.addEventListener("abort", alCancelar, { once: true });

  try {
    let respuesta: Response;
    let cuerpo: string;
    try {
      respuesta = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: control.signal,
      });
      cuerpo = await respuesta.text();
    } catch {
      if (signal?.aborted) throw new ApiError("Consulta cancelada", "cancelado", false);
      if (porTimeout)
        throw new ApiError(
          `La Rama Judicial no respondió en ${timeoutMs / 1000} s`,
          "timeout",
          true
        );
      throw new ApiError(
        "Error de red: no se pudo conectar con la Rama Judicial",
        "red",
        true
      );
    }

    if (!respuesta.ok) {
      const reintentable =
        respuesta.status === 408 ||
        respuesta.status === 429 ||
        respuesta.status >= 500;
      throw new ApiError(
        `La Rama Judicial respondió con error ${respuesta.status}`,
        "http",
        reintentable,
        respuesta.status
      );
    }

    try {
      return JSON.parse(cuerpo) as T;
    } catch {
      // A veces el servidor devuelve una página HTML de error con estado 200.
      throw new ApiError(
        "Respuesta inválida de la Rama Judicial",
        "respuesta_invalida",
        true
      );
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", alCancelar);
  }
}

/** Procesos asociados a un número de radicación (23 dígitos). */
export async function consultarRadicado(
  radicado: string,
  opciones: OpcionesPeticion = {}
): Promise<ProcesoResumen[]> {
  const url = `${BASE}/Procesos/Consulta/NumeroRadicacion?numero=${encodeURIComponent(
    radicado
  )}&SoloActivos=false&pagina=1`;
  const datos = await pedirJson<ApiRespuestaProcesos>(url, opciones);

  if (!datos || !Array.isArray(datos.procesos)) {
    throw new ApiError(
      "Respuesta inesperada de la Rama Judicial",
      "respuesta_invalida",
      true
    );
  }
  // cantidadRegistros viene dentro de "paginacion", no en la raíz.
  if (datos.procesos.length === 0 || datos.paginacion?.cantidadRegistros === 0) {
    throw new ApiError(
      "La Rama Judicial no tiene procesos con este radicado",
      "no_encontrado",
      false
    );
  }

  return datos.procesos.map((p) => ({
    idProceso: p.idProceso,
    llaveProceso: p.llaveProceso,
    fechaProceso: soloFecha(p.fechaProceso),
    fechaUltimaActuacion: soloFecha(p.fechaUltimaActuacion),
    despacho: limpiar(p.despacho),
    departamento: limpiar(p.departamento),
    sujetosProcesales: p.sujetosProcesales ? limpiar(p.sujetosProcesales) : null,
    esPrivado: Boolean(p.esPrivado),
  }));
}

/** Actuaciones de un proceso, de la más reciente a la más antigua. */
export async function consultarActuaciones(
  idProceso: number,
  opciones: OpcionesPeticion = {}
): Promise<Actuacion[]> {
  const url = `${BASE}/Proceso/Actuaciones/${idProceso}?pagina=1`;
  const datos = await pedirJson<ApiRespuestaActuaciones>(url, opciones);

  if (!datos || !Array.isArray(datos.actuaciones)) {
    throw new ApiError(
      "Respuesta inesperada de la Rama Judicial",
      "respuesta_invalida",
      true
    );
  }

  return datos.actuaciones
    .map((a) => ({
      consecutivo: a.consActuacion,
      fecha: soloFecha(a.fechaActuacion),
      actuacion: limpiar(a.actuacion),
      anotacion: limpiar(a.anotacion),
    }))
    .sort((a, b) => b.consecutivo - a.consecutivo);
}
