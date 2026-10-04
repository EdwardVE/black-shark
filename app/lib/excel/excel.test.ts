import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { actualizarRevisiones, evaluarBloque, fechaComparacion } from "./comparar";
import { generarExcel } from "./escribir";
import { leerMatriz } from "./leer";

/** Matriz mínima con el formato real: título, encabezado en la fila 3 y bloques combinados. */
async function matrizDePrueba(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet("Juzgados Laborales");
  hoja.getCell("B1").value = "MATRIZ";
  hoja.getRow(3).values = [null, "Juzgado ", "Demandante", "Demandado ", "Radicación ", "ULTIMA ACTUACION"];
  const filas = [
    ["2024-11-08\tRadicación de Proceso"],
    ["2026-09-23\tAuto de Trámite\tAUTO REPROGRAMA AUDIENCIA"],
  ];
  filas.forEach(([act], i) => {
    const r = 4 + i;
    hoja.getCell(`B${r}`).value = "Juzgado 21 Laboral";
    hoja.getCell(`E${r}`).value = "76001310500020240000100";
    hoja.getCell(`F${r}`).value = act;
  });
  hoja.mergeCells("B4:B5");
  hoja.mergeCells("E4:E5");
  hoja.getCell("E6").value = "22-000000-0"; // radicado de otra entidad
  hoja.getRow(8).values = [null, "Juzgado ", "Demandante", "Demandado ", "Radicación ", "Ultima Actuación"]; // encabezado repetido
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("Excel: leer y escribir", () => {
  it("agrupa los bloques y lee el status anterior", async () => {
    const matriz = await leerMatriz(await matrizDePrueba(), "matriz.xlsx");
    const [hoja] = matriz.hojas;
    expect(hoja.filaEncabezado).toBe(3);
    expect(hoja.bloques).toHaveLength(2);
    const [b, otro] = hoja.bloques;
    expect(b).toMatchObject({ filaInicio: 4, filaFin: 5, consultable: true, juzgado: "Juzgado 21 Laboral" });
    expect(b.registradas.at(-1)?.fecha).toBe("2026-09-23");
    expect(otro.consultable).toBe(false);
  });

  it("añade la hoja Status primero y deja intactas las demás", async () => {
    const matriz = await leerMatriz(await matrizDePrueba(), "matriz.xlsx");
    const resultados = matriz.hojas[0].bloques.map((b) => evaluarBloque(b, null));
    const salida = await generarExcel({ libro: matriz.libro, resultados, fecha: "2026-10-04" });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(salida);
    expect(wb.worksheets.map((h) => h.name)).toEqual(["Status 2026-10-04", "Juzgados Laborales"]);

    const original = wb.getWorksheet("Juzgados Laborales")!;
    expect(original.getCell("F5").value).toBe("2026-09-23\tAuto de Trámite\tAUTO REPROGRAMA AUDIENCIA");
    expect(original.model.merges).toEqual(expect.arrayContaining(["B4:B5", "E4:E5"]));

    const status = wb.getWorksheet("Status 2026-10-04")!;
    expect(status.getCell("F5").value).toBe("76001310500020240000100");

    // Una segunda revisión ignora la hoja Status anterior al leer.
    const releida = await leerMatriz(salida, "matriz_status_2026-10-04.xlsx");
    expect(releida.hojas.map((h) => h.nombre)).toEqual(["Juzgados Laborales"]);
  });

  it("guarda la revisión y al día siguiente no repite el cambio", async () => {
    const rad = "76001310500020240000100";
    const datosHoy = {
      radicado: rad,
      procesos: [],
      principal: null,
      actuaciones: [{ consecutivo: 18, fecha: "2026-10-01", actuacion: "Sentencia", anotacion: "CONDENA" }],
      error: null,
      peticiones: 2,
    };
    const dia1 = await leerMatriz(await matrizDePrueba(), "matriz.xlsx");
    const bloques1 = dia1.hojas[0].bloques;
    const resultados1 = bloques1.map((b) => evaluarBloque(b, b.radicado === rad ? datosHoy : null));
    expect(resultados1[0].estado).toBe("cambio");

    const salida = await generarExcel({
      libro: dia1.libro,
      resultados: resultados1,
      fecha: "2026-10-04",
      revisiones: actualizarRevisiones(dia1.revisiones, [datosHoy], "2026-10-04"),
    });

    const dia2 = await leerMatriz(salida, "matriz_status_2026-10-04.xlsx");
    const [b2] = dia2.hojas[0].bloques;
    expect(b2.revisionPrevia).toMatchObject({ fecha: "2026-10-01", revisadoEl: "2026-10-04" });
    expect(fechaComparacion(b2)).toBe("2026-10-01");
    // Sin actuaciones nuevas en la Rama Judicial: ya no aparece como cambio.
    expect(evaluarBloque(b2, datosHoy).estado).toBe("sin_cambios");
  });
});
