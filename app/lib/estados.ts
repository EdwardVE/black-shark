// lib/estados.ts
// Etiquetas y colores de cada estado, compartidos por la pantalla y el Excel.

import type { Estado } from "./tipos";

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  cambio: "Cambió de status",
  nuevo: "Sin historial",
  error: "No verificado",
  no_encontrado: "No encontrado",
  reservado: "Reservado",
  sin_cambios: "Sin cambios",
  no_aplica: "No aplica",
};

/** Clases de Tailwind para las insignias en pantalla. */
export const CLASES_ESTADO: Record<Estado, string> = {
  cambio: "bg-warn-bg text-warn",
  nuevo: "bg-info-bg text-info",
  error: "bg-danger-bg text-danger",
  no_encontrado: "bg-danger-bg text-danger",
  reservado: "bg-surface-2 text-muted",
  sin_cambios: "bg-ok-bg text-ok",
  no_aplica: "bg-surface-2 text-muted",
};

/** Texto de una actuación para leer en pantalla (las tabulaciones se ven como "·"). */
export const legible = (s: string | null | undefined) =>
  (s ?? "").replace(/\t+/g, " · ").trim();

export type Filtro = "cambios" | "problemas" | "sin_cambios" | "no_aplica" | "todos";

export const ESTADOS_POR_FILTRO: Record<Filtro, Estado[] | null> = {
  cambios: ["cambio", "nuevo"],
  problemas: ["error", "no_encontrado", "reservado"],
  sin_cambios: ["sin_cambios"],
  no_aplica: ["no_aplica"],
  todos: null,
};

/** Relleno (ARGB) de la fila en la hoja resumen del Excel. */
export const RELLENO_EXCEL: Partial<Record<Estado, string>> = {
  cambio: "FFFEF08A",
  nuevo: "FFBFDBFE",
  error: "FFFECACA",
  no_encontrado: "FFFECACA",
};
