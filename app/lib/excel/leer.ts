// lib/excel/leer.ts
// Lee la matriz de procesos: en cada hoja busca la fila de encabezados, las
// columnas (Radicación, Actuación, Juzgado, partes) y agrupa las filas
// consecutivas de un mismo radicado en bloques.

import type { CellValue, Workbook, Worksheet } from "exceljs";
import type { BloqueRadicado, RevisionPrevia } from "../tipos";
import { parsearRegistro } from "./comparar";

export const PREFIJO_HOJA_STATUS = "Status ";
/** Hoja oculta con lo visto en la última revisión de cada radicado. */
export const HOJA_REVISIONES = "_blackshark";
export const COLUMNAS_REVISIONES = ["Radicado", "Fecha última actuación", "Status", "Revisado el"];

/** exceljs pesa ~1 MB: se carga solo cuando hace falta. */
export async function cargarExcelJS() {
  const modulo = await import("exceljs");
  return (modulo as unknown as { default?: typeof modulo }).default ?? modulo;
}

const aFecha = (d: Date) => d.toISOString().slice(0, 10);

/** Texto visible de una celda, sea cual sea su tipo en exceljs. */
export function textoCelda(valor: CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return aFecha(valor);
  if (typeof valor !== "object") return String(valor);
  if ("richText" in valor) return valor.richText.map((r) => r.text).join("");
  if ("formula" in valor || "sharedFormula" in valor) {
    return textoCelda((valor as { result?: CellValue }).result ?? null);
  }
  if ("text" in valor) return textoCelda(valor.text as CellValue);
  return "";
}

export interface HojaLeida {
  nombre: string;
  filaEncabezado: number;
  bloques: BloqueRadicado[];
}

export interface MatrizLeida {
  libro: Workbook;
  nombreArchivo: string;
  hojas: HojaLeida[];
  hojasOmitidas: { nombre: string; motivo: string }[];
  /** Última revisión guardada por radicado (vacío si el Excel nunca pasó por la app). */
  revisiones: Map<string, RevisionPrevia>;
}

function leerRevisiones(libro: Workbook): Map<string, RevisionPrevia> {
  const revisiones = new Map<string, RevisionPrevia>();
  const hoja = libro.getWorksheet(HOJA_REVISIONES);
  if (!hoja) return revisiones;
  hoja.eachRow((fila, n) => {
    if (n === 1) return;
    const [radicado, fecha, status, revisadoEl] = [1, 2, 3, 4].map((c) =>
      textoCelda(fila.getCell(c).value).trim()
    );
    if (radicado && fecha) revisiones.set(radicado, { fecha, status, revisadoEl });
  });
  return revisiones;
}

interface Columnas {
  fila: number;
  radicado: number;
  actuacion: number | null;
  juzgado: number | null;
  demandante: number | null;
  demandado: number | null;
}

const FILAS_BUSQUEDA_ENCABEZADO = 15;

function detectarColumnas(hoja: Worksheet): Columnas | null {
  const limite = Math.min(FILAS_BUSQUEDA_ENCABEZADO, hoja.rowCount);
  for (let fila = 1; fila <= limite; fila++) {
    const encabezados = new Map<number, string>();
    hoja.getRow(fila).eachCell((celda, col) => {
      encabezados.set(col, textoCelda(celda.value).trim().toLowerCase());
    });
    const buscar = (patron: RegExp) =>
      [...encabezados].find(([, t]) => patron.test(t))?.[0] ?? null;

    const radicado = buscar(/radicaci|^radicado/);
    if (radicado === null) continue;
    return {
      fila,
      radicado,
      actuacion: buscar(/actuaci/),
      juzgado: buscar(/juzgado|magistrad|despacho|superintendencia|fiscal/),
      demandante: buscar(/demandante|denunciante|accionante/),
      demandado: buscar(/demandado|accionado/),
    };
  }
  return null;
}

/** Radicado de 23 dígitos (admite espacios o guiones entre grupos). */
export function normalizarRadicado(crudo: string): string | null {
  const digitos = crudo.replace(/\D/g, "");
  if (digitos.length === 23) return digitos;
  return crudo.match(/\d{23}/)?.[0] ?? null;
}

export function leerHoja(hoja: Worksheet): HojaLeida | { omitida: string } {
  const cols = detectarColumnas(hoja);
  if (!cols) return { omitida: "No tiene una columna «Radicación»." };
  if (cols.actuacion === null) return { omitida: "No tiene una columna «Actuación»." };

  const texto = (fila: number, col: number | null) =>
    col === null ? "" : textoCelda(hoja.getRow(fila).getCell(col).value).trim();

  const bloques: BloqueRadicado[] = [];
  let actual: BloqueRadicado | null = null;

  for (let fila = cols.fila + 1; fila <= hoja.rowCount; fila++) {
    const celdaRadicado = hoja.getRow(fila).getCell(cols.radicado);
    const crudo = textoCelda(celdaRadicado.value).trim();
    // Una fila sin radicado, o un encabezado repetido a mitad de hoja, separa bloques.
    if (!crudo || /radicaci/i.test(crudo)) {
      actual = null;
      continue;
    }

    if (!actual || actual.radicadoCrudo !== crudo || actual.filaFin !== fila - 1) {
      const radicado = normalizarRadicado(crudo);
      const esNumero = typeof celdaRadicado.value === "number";
      actual = {
        hoja: hoja.name,
        filaInicio: fila,
        filaFin: fila,
        radicadoCrudo: crudo,
        radicado: radicado ?? crudo,
        consultable: radicado !== null && !esNumero,
        motivoNoConsultable: esNumero
          ? "Excel guardó el radicado como número y perdió dígitos; escríbelo como texto."
          : radicado === null
            ? "No es un radicado de 23 dígitos de la Rama Judicial."
            : null,
        juzgado: texto(fila, cols.juzgado),
        demandante: texto(fila, cols.demandante),
        demandado: texto(fila, cols.demandado),
        registradas: [],
      };
      bloques.push(actual);
    }
    actual.filaFin = fila;

    const actuacion = texto(fila, cols.actuacion);
    if (actuacion) actual.registradas.push(parsearRegistro(actuacion));
  }

  return { nombre: hoja.name, filaEncabezado: cols.fila, bloques };
}

export async function leerMatriz(
  datos: ArrayBuffer,
  nombreArchivo: string
): Promise<MatrizLeida> {
  const ExcelJS = await cargarExcelJS();
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(datos);

  const hojas: HojaLeida[] = [];
  const hojasOmitidas: MatrizLeida["hojasOmitidas"] = [];
  for (const hoja of libro.worksheets) {
    // Las hojas de resumen de revisiones anteriores no son parte de la matriz.
    if (hoja.name.startsWith(PREFIJO_HOJA_STATUS) || hoja.state !== "visible") continue;
    const leida = leerHoja(hoja);
    if ("omitida" in leida) hojasOmitidas.push({ nombre: hoja.name, motivo: leida.omitida });
    else if (leida.bloques.length > 0) hojas.push(leida);
    else hojasOmitidas.push({ nombre: hoja.name, motivo: "No tiene radicados." });
  }

  const revisiones = leerRevisiones(libro);
  for (const b of hojas.flatMap((h) => h.bloques)) {
    b.revisionPrevia = revisiones.get(b.radicado) ?? null;
  }
  return { libro, nombreArchivo, hojas, hojasOmitidas, revisiones };
}

/** Bloques a partir de radicados pegados a mano (sin historial). */
export function bloquesDesdeTexto(texto: string): BloqueRadicado[] {
  const vistos = new Set<string>();
  const bloques: BloqueRadicado[] = [];
  for (const crudo of texto.split(/[\s,;]+/)) {
    if (!crudo || vistos.has(crudo)) continue;
    vistos.add(crudo);
    const radicado = normalizarRadicado(crudo);
    bloques.push({
      hoja: "Lista pegada",
      filaInicio: bloques.length + 1,
      filaFin: bloques.length + 1,
      radicadoCrudo: crudo,
      radicado: radicado ?? crudo,
      consultable: radicado !== null,
      motivoNoConsultable: radicado ? null : "No es un radicado de 23 dígitos.",
      juzgado: "",
      demandante: "",
      demandado: "",
      registradas: [],
    });
  }
  return bloques;
}
