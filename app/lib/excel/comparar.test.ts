import { describe, expect, it } from "vitest";
import type { Actuacion, BloqueRadicado, DatosRama } from "../tipos";
import {
  actuacionesNuevas,
  evaluarBloque,
  normalizar,
  parsearFecha,
  parsearRegistro,
} from "./comparar";

const act = (fecha: string, actuacion: string, anotacion = "", consecutivo = 0): Actuacion => ({
  fecha,
  actuacion,
  anotacion,
  consecutivo,
});

const bloque = (filas: string[]): BloqueRadicado => ({
  hoja: "Hoja",
  filaInicio: 5,
  filaFin: 5 + filas.length,
  radicadoCrudo: "76001310500020240000100",
  radicado: "76001310500020240000100",
  consultable: true,
  motivoNoConsultable: null,
  juzgado: "Juzgado 21",
  demandante: "A",
  demandado: "B",
  registradas: filas.map(parsearRegistro),
});

const datos = (actuaciones: Actuacion[] | null, extra: Partial<DatosRama> = {}): DatosRama => ({
  radicado: "76001310500020240000100",
  procesos: [],
  principal: null,
  actuaciones,
  error: null,
  peticiones: 2,
  ...extra,
});

describe("parsearFecha", () => {
  it.each([
    ["2022-08-01\tAuto tiene por contestada", "2022-08-01"],
    ["2023-02-23 auto fija fecha audiencia", "2023-02-23"],
    ["14/11/19. Auto Admite Demanda", "2019-11-14"],
    ["25 01 2022 RADICACION", "2022-01-25"],
    ["25-05-2022 PRESENTACIÓN DEMANDA", "2022-05-25"],
    ["25-05-08 · Envío Expediente", "2025-05-08"],
    ["08/05/25 Envío", "2025-05-08"],
    ["ESTA EN EL TRIBUNAL", null],
    ["1.se interpuso tutela", null],
  ])("%s → %s", (texto, esperado) => {
    expect(parsearFecha(texto)).toBe(esperado);
  });
});

describe("parsearRegistro", () => {
  it("separa el formato copiado del portal", () => {
    const r = parsearRegistro("2023-12-04\tAuto admite tutela\t9637 - AUTO");
    expect(r).toMatchObject({ fecha: "2023-12-04", nombre: "Auto admite tutela" });
  });
  it("quita la fecha en formato libre", () => {
    expect(parsearRegistro("14/11/19. Auto Admite Demanda").nombre).toBe("Auto Admite Demanda");
  });
});

describe("normalizar", () => {
  it("ignora tildes, mayúsculas y espacios", () => {
    expect(normalizar("  Fijación   estado ")).toBe(normalizar("FIJACION ESTADO"));
  });
});

describe("actuacionesNuevas", () => {
  const registradas = ["2026-07-07\tRecepción memorial", "2026-09-23\tAuto de Trámite\tAUTO REPROGRAMA"].map(
    parsearRegistro
  );

  it("devuelve lo posterior a la última fecha registrada", () => {
    const nuevas = actuacionesNuevas(registradas, [
      act("2026-10-01", "Auto fija fecha audiencia"),
      act("2026-09-23", "Auto de Trámite"),
      act("2026-07-07", "Recepción memorial"),
    ]);
    expect(nuevas.map((a) => a.actuacion)).toEqual(["Auto fija fecha audiencia"]);
  });

  it("detecta otra actuación del mismo día que no está en la matriz", () => {
    const nuevas = actuacionesNuevas(registradas, [
      act("2026-09-23", "Fijacion estado"),
      act("2026-09-23", "Auto de Trámite"),
    ]);
    expect(nuevas.map((a) => a.actuacion)).toEqual(["Fijacion estado"]);
  });

  it("sin fechas legibles, corta en la primera actuación reconocida", () => {
    const sinFecha = [parsearRegistro("Auto admite demanda")];
    const nuevas = actuacionesNuevas(sinFecha, [
      act("2026-02-01", "Sentencia"),
      act("2025-01-01", "Auto admite demanda"),
    ]);
    expect(nuevas.map((a) => a.actuacion)).toEqual(["Sentencia"]);
  });
});

describe("evaluarBloque", () => {
  const b = bloque(["2026-07-07\tRecepción memorial", "2026-09-23\tAuto de Trámite"]);

  it("marca cambio con el status anterior y el actual", () => {
    const r = evaluarBloque(b, datos([act("2026-10-01", "Sentencia", "CONDENA"), act("2026-09-23", "Auto de Trámite")]));
    expect(r.estado).toBe("cambio");
    expect(r.statusAnterior).toBe("2026-09-23\tAuto de Trámite");
    expect(r.statusActual).toBe("2026-10-01\tSentencia\tCONDENA");
    expect(r.nuevas).toHaveLength(1);
  });

  it("sin cambios cuando no se pidieron actuaciones (sin movimiento)", () => {
    const r = evaluarBloque(b, datos(null));
    expect(r.estado).toBe("sin_cambios");
    expect(r.statusActual).toBe(r.statusAnterior);
  });

  it("conserva el status anterior si la consulta falló", () => {
    const r = evaluarBloque(b, datos(null, { error: { tipo: "timeout", mensaje: "No verificado hoy" } }));
    expect(r.estado).toBe("error");
    expect(r.statusActual).toBe("2026-09-23\tAuto de Trámite");
  });

  it("bloque sin actuaciones en la matriz queda como nuevo", () => {
    const r = evaluarBloque(bloque([]), datos([act("2026-10-01", "Sentencia")]));
    expect(r.estado).toBe("nuevo");
    expect(r.statusActual).toBe("2026-10-01\tSentencia");
  });

  it("compara con la última revisión si la matriz quedó atrás", () => {
    const conRevision = {
      ...b,
      revisionPrevia: {
        fecha: "2026-10-01",
        status: "2026-10-01\tSentencia\tCONDENA",
        revisadoEl: "2026-10-04",
      },
    };
    const mismo = evaluarBloque(conRevision, datos([act("2026-10-01", "Sentencia", "CONDENA")]));
    expect(mismo.estado).toBe("sin_cambios");
    expect(mismo.statusAnterior).toBe("2026-10-01\tSentencia\tCONDENA");
    expect(mismo.detalle).toContain("revisión del 2026-10-04");

    const otro = evaluarBloque(conRevision, datos([act("2026-10-05", "Auto fija audiencia"), act("2026-10-01", "Sentencia")]));
    expect(otro.estado).toBe("cambio");
    expect(otro.nuevas.map((a) => a.actuacion)).toEqual(["Auto fija audiencia"]);
  });

  it("ignora una revisión más antigua que la matriz", () => {
    const vieja = { ...b, revisionPrevia: { fecha: "2020-01-01", status: "2020-01-01\tX", revisadoEl: "2020-01-02" } };
    expect(evaluarBloque(vieja, datos(null)).statusAnterior).toBe("2026-09-23\tAuto de Trámite");
  });

  it("radicado no consultable", () => {
    const r = evaluarBloque({ ...b, consultable: false, motivoNoConsultable: "x" }, null);
    expect(r.estado).toBe("no_aplica");
  });
});
