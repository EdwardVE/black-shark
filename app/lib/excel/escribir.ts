// lib/excel/escribir.ts
// Genera el Excel de salida: las hojas del usuario quedan intactas y se añade
// al inicio una hoja "Status AAAA-MM-DD" con una fila por bloque de radicado.

import type { Workbook } from "exceljs";
import type { ResultadoBloque, RevisionPrevia } from "../tipos";
import { ETIQUETA_ESTADO, RELLENO_EXCEL } from "../estados";
import { ordenarResultados, textoActuacion } from "./comparar";
import { cargarExcelJS, COLUMNAS_REVISIONES, HOJA_REVISIONES, PREFIJO_HOJA_STATUS } from "./leer";

export const TIPO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COLUMNAS = [
  { header: "Estado", width: 18 },
  { header: "Hoja", width: 22 },
  { header: "Juzgado / Despacho", width: 32 },
  { header: "Demandante", width: 26 },
  { header: "Demandado", width: 26 },
  { header: "Radicado", width: 27 },
  { header: "Status anterior (matriz o última revisión)", width: 50 },
  { header: "Status actual (Rama Judicial)", width: 50 },
  { header: "Fecha status actual", width: 14 },
  { header: "Actuaciones nuevas (para copiar)", width: 70 },
  { header: "Detalle", width: 40 },
];

const FILA_ENCABEZADO = 4;

export function nombreSalida(nombreOriginal: string | null, fecha: string): string {
  const base = (nombreOriginal ?? "procesos")
    .replace(/\.xlsx$/i, "")
    .replace(/_status_\d{4}-\d{2}-\d{2}$/, "");
  return `${base}_status_${fecha}.xlsx`;
}

/** Resumen de conteos, p. ej. "3 cambios · 120 sin cambios · 2 no verificados". */
export function resumenConteos(resultados: ResultadoBloque[]): string {
  const conteo = new Map<string, number>();
  for (const r of ordenarResultados(resultados)) {
    const etiqueta = ETIQUETA_ESTADO[r.estado];
    conteo.set(etiqueta, (conteo.get(etiqueta) ?? 0) + 1);
  }
  return [...conteo].map(([e, n]) => `${e}: ${n}`).join(" · ");
}

/** Reescribe la hoja oculta con la última revisión de cada radicado. */
function escribirRevisiones(wb: Workbook, revisiones: Map<string, RevisionPrevia>) {
  const previa = wb.getWorksheet(HOJA_REVISIONES);
  if (previa) wb.removeWorksheet(previa.id);
  const hoja = wb.addWorksheet(HOJA_REVISIONES, { state: "hidden" });
  hoja.addRow(COLUMNAS_REVISIONES);
  for (const [radicado, r] of [...revisiones].sort(([a], [b]) => a.localeCompare(b))) {
    hoja.addRow([radicado, r.fecha, r.status, r.revisadoEl]);
  }
}

export async function generarExcel({
  libro,
  resultados,
  fecha,
  revisiones,
}: {
  libro: Workbook | null;
  resultados: ResultadoBloque[];
  fecha: string;
  revisiones?: Map<string, RevisionPrevia>;
}): Promise<ArrayBuffer> {
  const ExcelJS = await cargarExcelJS();
  const wb = libro ?? new ExcelJS.Workbook();
  const nombreHoja = `${PREFIJO_HOJA_STATUS}${fecha}`;

  // Repetir la revisión el mismo día reemplaza la hoja de ese día.
  const previa = wb.getWorksheet(nombreHoja);
  if (previa) wb.removeWorksheet(previa.id);

  // exceljs ordena las pestañas por `orderNo`, que existe pero no está en sus tipos.
  type ConOrden = { orderNo?: number };
  const primerOrden = Math.min(0, ...wb.worksheets.map((h) => (h as ConOrden).orderNo ?? 0));
  const hoja = wb.addWorksheet(nombreHoja, {
    views: [{ state: "frozen", ySplit: FILA_ENCABEZADO }],
    properties: { tabColor: { argb: "FF047857" } },
  });
  (hoja as ConOrden).orderNo = primerOrden - 1; // queda como primera pestaña

  hoja.getCell("A1").value = `Status de procesos · revisión del ${fecha}`;
  hoja.getCell("A1").font = { bold: true, size: 14 };
  hoja.getCell("A2").value = resumenConteos(resultados);
  hoja.getCell("A2").font = { italic: true };

  hoja.columns = COLUMNAS.map(({ width }) => ({ width }));
  const encabezado = hoja.getRow(FILA_ENCABEZADO);
  COLUMNAS.forEach(({ header }, i) => {
    const celda = encabezado.getCell(i + 1);
    celda.value = header;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
    celda.alignment = { vertical: "middle", wrapText: true };
  });

  for (const r of ordenarResultados(resultados)) {
    const fila = hoja.addRow([
      ETIQUETA_ESTADO[r.estado],
      r.bloque.hoja,
      r.bloque.juzgado || r.despacho,
      r.bloque.demandante,
      r.bloque.demandado,
      r.bloque.radicadoCrudo, // texto: nunca como número (perdería dígitos)
      r.statusAnterior ?? "",
      r.statusActual ?? "",
      r.fechaActual ?? "",
      r.nuevas.map(textoActuacion).join("\n"),
      r.detalle,
    ]);
    fila.alignment = { vertical: "top", wrapText: true };
    const relleno = RELLENO_EXCEL[r.estado];
    if (relleno) {
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: relleno } };
      });
    }
  }

  hoja.autoFilter = {
    from: { row: FILA_ENCABEZADO, column: 1 },
    to: { row: FILA_ENCABEZADO, column: COLUMNAS.length },
  };

  if (revisiones) escribirRevisiones(wb, revisiones);

  // Que el archivo abra en la hoja de status.
  if (wb.views?.length) wb.views[0] = { ...wb.views[0], activeTab: 0, firstSheet: 0 };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
