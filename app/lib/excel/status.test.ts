import { describe, expect, it, vi } from "vitest";
import type { Pedir } from "../api/cola";
import type { ProcesoResumen } from "../tipos";
import { obtenerDatosRama } from "./status";

const pedirDirecto: Pedir = (peticion) => peticion();

const proceso = (fechaUltimaActuacion: string, idProceso = 1): ProcesoResumen => ({
  idProceso,
  llaveProceso: "76001310500020240000100",
  fechaProceso: "2024-11-08",
  fechaUltimaActuacion,
  despacho: "JUZGADO 021 LABORAL DE CALI",
  departamento: "VALLE DEL CAUCA",
  sujetosProcesales: null,
  esPrivado: false,
});

function deps(procesos: ProcesoResumen[]) {
  return {
    consultarRadicado: vi.fn().mockResolvedValue(procesos),
    consultarActuaciones: vi.fn().mockResolvedValue([]),
  };
}

describe("obtenerDatosRama", () => {
  it("no pide actuaciones si el proceso no se movió", async () => {
    const d = deps([proceso("2026-09-23")]);
    const r = await obtenerDatosRama("x", "2026-09-23", pedirDirecto, d);
    expect(d.consultarActuaciones).not.toHaveBeenCalled();
    expect(r.actuaciones).toBeNull();
    expect(r.peticiones).toBe(1);
  });

  it("pide actuaciones del proceso más reciente si hubo movimiento", async () => {
    const d = deps([proceso("2025-01-01", 1), proceso("2026-10-01", 2)]);
    const r = await obtenerDatosRama("x", "2026-09-23", pedirDirecto, d);
    expect(d.consultarActuaciones).toHaveBeenCalledWith(2, expect.anything());
    expect(r.peticiones).toBe(2);
  });

  it("pide actuaciones si la matriz no tiene fecha", async () => {
    const d = deps([proceso("2020-01-01")]);
    await obtenerDatosRama("x", null, pedirDirecto, d);
    expect(d.consultarActuaciones).toHaveBeenCalled();
  });
});
