// lib/tipos.ts
// Tipos compartidos entre la API, la comparación y el Excel.
// Las fechas son siempre texto "AAAA-MM-DD" (o null si no hay).

/** Un proceso tal como lo devuelve la búsqueda por radicado. */
export interface ProcesoResumen {
  idProceso: number;
  llaveProceso: string;
  fechaProceso: string | null;
  fechaUltimaActuacion: string | null;
  despacho: string;
  departamento: string;
  sujetosProcesales: string | null;
  esPrivado: boolean;
}

/** Una actuación publicada por la Rama Judicial. */
export interface Actuacion {
  consecutivo: number;
  fecha: string | null;
  actuacion: string;
  anotacion: string;
}

/** Una fila de actuación ya registrada en la matriz del usuario. */
export interface ActuacionRegistrada {
  fecha: string | null;
  nombre: string;
  texto: string;
}

/**
 * Lo que la app vio de un radicado en la última revisión. Se guarda en la hoja
 * oculta "_blackshark" del Excel para que la siguiente revisión compare contra
 * ella y no solo contra la matriz (que puede estar atrasada).
 */
export interface RevisionPrevia {
  /** Fecha de la actuación más reciente vista. */
  fecha: string;
  /** Actuaciones de esa fecha (fecha ⇥ actuación ⇥ anotación), una por línea, la más reciente primero. */
  status: string;
  /** Día de la revisión. */
  revisadoEl: string;
}

/** Un bloque de filas de un mismo radicado dentro de una hoja del Excel. */
export interface BloqueRadicado {
  hoja: string;
  filaInicio: number;
  filaFin: number;
  radicadoCrudo: string;
  /** Solo dígitos. */
  radicado: string;
  /** false si no es un radicado de 23 dígitos de la Rama Judicial. */
  consultable: boolean;
  motivoNoConsultable: string | null;
  juzgado: string;
  demandante: string;
  demandado: string;
  registradas: ActuacionRegistrada[];
  /** Última revisión guardada para este radicado, si la hay. */
  revisionPrevia?: RevisionPrevia | null;
}

export type Estado =
  | "cambio"
  | "nuevo"
  | "error"
  | "no_encontrado"
  | "reservado"
  | "sin_cambios"
  | "no_aplica";

/** Lo que se obtuvo de la Rama Judicial para un radicado. */
export interface DatosRama {
  radicado: string;
  procesos: ProcesoResumen[];
  principal: ProcesoResumen | null;
  /** null = no se consultaron porque el proceso no tuvo movimiento. */
  actuaciones: Actuacion[] | null;
  error: { tipo: string; mensaje: string } | null;
  peticiones: number;
}

/** Resultado final de un bloque: lo que se muestra y se escribe en el Excel. */
export interface ResultadoBloque {
  bloque: BloqueRadicado;
  estado: Estado;
  statusAnterior: string | null;
  fechaAnterior: string | null;
  statusActual: string | null;
  fechaActual: string | null;
  /** Actuaciones posteriores al status anterior, de la más reciente a la más antigua. */
  nuevas: Actuacion[];
  despacho: string;
  detalle: string;
}
