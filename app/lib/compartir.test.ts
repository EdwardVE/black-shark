import { describe, expect, it } from "vitest";
import { resumenTexto } from "./compartir";
import { evaluarBloque, parsearRegistro } from "./excel/comparar";
import type { BloqueRadicado } from "./tipos";

const bloque = (radicado: string, filas: string[]): BloqueRadicado => ({
  hoja: "Laborales",
  filaInicio: 1,
  filaFin: 1,
  radicadoCrudo: radicado,
  radicado,
  consultable: true,
  motivoNoConsultable: null,
  juzgado: "Juzgado 4 Laboral",
  demandante: "",
  demandado: "",
  registradas: filas.map(parsearRegistro),
});

describe("resumenTexto", () => {
  it("lista los cambios con antes y ahora, y cuenta el resto", () => {
    const cambio = evaluarBloque(bloque("76001310500020230000200", ["2026-02-19\tConsulta Expediente Digital"]), {
      radicado: "76001310500020230000200",
      procesos: [],
      principal: null,
      actuaciones: [{ consecutivo: 2, fecha: "2026-09-14", actuacion: "Fijacion estado", anotacion: "" }],
      error: null,
      peticiones: 2,
    });
    const igual = evaluarBloque(bloque("76001310500020190000300", ["2024-06-13\tFijacion estado"]), {
      radicado: "76001310500020190000300",
      procesos: [],
      principal: null,
      actuaciones: null,
      error: null,
      peticiones: 1,
    });

    const texto = resumenTexto([igual, cambio], "2026-10-04");
    expect(texto).toContain("1 proceso(s) con status nuevo");
    expect(texto).toContain("Antes: 2026-02-19 · Consulta Expediente Digital");
    expect(texto).toContain("Ahora: 2026-09-14 · Fijacion estado");
    expect(texto).toContain("Sin cambios: 1");
  });
});
