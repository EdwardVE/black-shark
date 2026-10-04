// lib/api/cola.ts
// Ejecuta consultas una por una contra la API del Estado, que es inestable:
// ritmo pausado con jitter, reintentos con espera exponencial y un
// cortacircuitos que pausa (y luego detiene) si la API deja de responder.

import { ApiError } from "./judicial";

export type Dormir = (ms: number, signal?: AbortSignal) => Promise<void>;

export const dormir: Dormir = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError("Consulta cancelada", "cancelado", false));
      return;
    }
    const alCancelar = () => {
      clearTimeout(timer);
      reject(new ApiError("Consulta cancelada", "cancelado", false));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", alCancelar);
      resolve();
    }, ms);
    signal?.addEventListener("abort", alCancelar, { once: true });
  });

export interface Ritmo {
  /** Pausa mínima entre peticiones. */
  intervaloMs: number;
  /** Reintentos por petición tras el primer intento. */
  reintentos: number;
  /** Espera del primer reintento; se duplica en cada uno. */
  baseReintentoMs: number;
  /** Radicados fallidos seguidos que disparan la pausa. */
  fallosParaPausa: number;
  pausaMs: number;
}

export const RITMO_POR_DEFECTO: Ritmo = {
  intervaloMs: 2000,
  reintentos: 3,
  baseReintentoMs: 2000,
  fallosParaPausa: 3,
  pausaMs: 60000,
};

export interface Entorno {
  dormir: Dormir;
  aleatorio: () => number;
  ahora: () => number;
}

const ENTORNO_REAL: Entorno = {
  dormir,
  aleatorio: Math.random,
  ahora: () => Date.now(),
};

/** ms ± fraccion (por defecto ±30 %), para no golpear el servidor a ritmo fijo. */
export function conJitter(ms: number, aleatorio: () => number, fraccion = 0.3) {
  return Math.round(ms * (1 - fraccion + aleatorio() * 2 * fraccion));
}

export type EventoCola =
  | { tipo: "reintento"; intento: number; esperaMs: number; error: ApiError }
  | { tipo: "pausa"; hasta: number }
  | { tipo: "reanudada" }
  | { tipo: "detenida"; motivo: string };

/** Hace una petición respetando el ritmo y reintentando si el error lo permite. */
export type Pedir = <T>(peticion: (signal?: AbortSignal) => Promise<T>) => Promise<T>;

function aApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(e instanceof Error ? e.message : String(e), "red", true);
}

export function crearPedir(
  ritmo: Ritmo,
  entorno: Entorno,
  signal?: AbortSignal,
  onEvento?: (e: EventoCola) => void
): Pedir {
  let ultimaPeticion = -Infinity;

  const esperarTurno = async () => {
    const espera =
      ultimaPeticion + conJitter(ritmo.intervaloMs, entorno.aleatorio) - entorno.ahora();
    if (espera > 0) await entorno.dormir(espera, signal);
    ultimaPeticion = entorno.ahora();
  };

  return async (peticion) => {
    for (let intento = 0; ; intento++) {
      await esperarTurno();
      try {
        return await peticion(signal);
      } catch (e) {
        const error = aApiError(e);
        if (!error.reintentable || intento >= ritmo.reintentos) throw error;
        const esperaMs = conJitter(ritmo.baseReintentoMs * 2 ** intento, entorno.aleatorio);
        onEvento?.({ tipo: "reintento", intento: intento + 1, esperaMs, error });
        await entorno.dormir(esperaMs, signal);
      }
    }
  };
}

export interface OpcionesCola<T, R> {
  /** Trabajo por elemento; usa `pedir` para cada petición a la API. */
  tarea: (item: T, pedir: Pedir) => Promise<R>;
  /** Resultado para un elemento que falló o no se alcanzó a consultar. */
  alFallar: (item: T, error: ApiError) => R;
  alTerminarItem?: (resultado: R, hechos: number, total: number) => void;
  onEvento?: (e: EventoCola) => void;
  signal?: AbortSignal;
  ritmo?: Partial<Ritmo>;
  entorno?: Partial<Entorno>;
}

export async function ejecutarCola<T, R>(
  items: T[],
  opciones: OpcionesCola<T, R>
): Promise<{ resultados: R[]; detenida: boolean }> {
  const ritmo = { ...RITMO_POR_DEFECTO, ...opciones.ritmo };
  const entorno = { ...ENTORNO_REAL, ...opciones.entorno };
  const { signal, onEvento } = opciones;
  const pedir = crearPedir(ritmo, entorno, signal, onEvento);

  const resultados: R[] = [];
  let fallosSeguidos = 0;
  let yaPauso = false;
  let detenida: ApiError | null = null;

  const registrar = (r: R) => {
    resultados.push(r);
    opciones.alTerminarItem?.(r, resultados.length, items.length);
  };

  for (const item of items) {
    if (signal?.aborted) {
      detenida = new ApiError("Consulta cancelada", "cancelado", false);
    }
    if (detenida) {
      registrar(opciones.alFallar(item, detenida));
      continue;
    }

    try {
      registrar(await opciones.tarea(item, pedir));
      fallosSeguidos = 0;
      yaPauso = false;
    } catch (e) {
      const error = aApiError(e);
      registrar(opciones.alFallar(item, error));
      if (error.tipo === "cancelado") {
        detenida = error;
        continue;
      }
      if (!error.reintentable) continue; // p. ej. 404: la API sí respondió

      fallosSeguidos++;
      if (fallosSeguidos < ritmo.fallosParaPausa) continue;

      if (yaPauso) {
        detenida = new ApiError(
          "La Rama Judicial no responde. Se detuvo la consulta; puedes reintentar más tarde.",
          "red",
          true
        );
        onEvento?.({ tipo: "detenida", motivo: detenida.message });
        continue;
      }
      yaPauso = true;
      fallosSeguidos = 0;
      onEvento?.({ tipo: "pausa", hasta: entorno.ahora() + ritmo.pausaMs });
      try {
        await entorno.dormir(ritmo.pausaMs, signal);
        onEvento?.({ tipo: "reanudada" });
      } catch (pausaError) {
        detenida = aApiError(pausaError);
      }
    }
  }

  return { resultados, detenida: detenida !== null };
}
