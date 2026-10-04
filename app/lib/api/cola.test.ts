import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./judicial";
import { ejecutarCola, type Entorno, type EventoCola } from "./cola";

/** Entorno sin esperas reales: registra cada pausa y avanza un reloj falso. */
function entornoFalso() {
  let reloj = 0;
  const esperas: number[] = [];
  const entorno: Entorno = {
    dormir: async (ms, signal) => {
      if (signal?.aborted) throw new ApiError("Consulta cancelada", "cancelado", false);
      esperas.push(ms);
      reloj += ms;
    },
    aleatorio: () => 0.5, // sin jitter
    ahora: () => reloj,
  };
  return { entorno, esperas };
}

const fallaRed = () => new ApiError("caída", "red", true);

describe("ejecutarCola", () => {
  it("reintenta con espera exponencial y luego tiene éxito", async () => {
    const { entorno, esperas } = entornoFalso();
    const peticion = vi
      .fn()
      .mockRejectedValueOnce(fallaRed())
      .mockRejectedValueOnce(fallaRed())
      .mockResolvedValue("ok");

    const { resultados } = await ejecutarCola(["a"], {
      tarea: (_item, pedir) => pedir(peticion),
      alFallar: () => "fallo",
      entorno,
    });

    expect(resultados).toEqual(["ok"]);
    expect(peticion).toHaveBeenCalledTimes(3);
    // reintentos de 2 s y 4 s (más el ritmo entre peticiones)
    expect(esperas).toContain(2000);
    expect(esperas).toContain(4000);
  });

  it("no reintenta errores definitivos (no encontrado)", async () => {
    const { entorno } = entornoFalso();
    const peticion = vi.fn().mockRejectedValue(new ApiError("404", "no_encontrado", false));
    const { resultados } = await ejecutarCola(["a"], {
      tarea: (_i, pedir) => pedir(peticion),
      alFallar: (_i, e) => e.tipo,
      entorno,
    });
    expect(resultados).toEqual(["no_encontrado"]);
    expect(peticion).toHaveBeenCalledTimes(1);
  });

  it("deja al menos el intervalo entre peticiones", async () => {
    const { entorno, esperas } = entornoFalso();
    await ejecutarCola(["a", "b", "c"], {
      tarea: (_i, pedir) => pedir(async () => "ok"),
      alFallar: () => "fallo",
      entorno,
    });
    expect(esperas.filter((ms) => ms === 2000)).toHaveLength(2);
  });

  it("pausa tras 3 radicados fallidos y se detiene si sigue fallando", async () => {
    const { entorno, esperas } = entornoFalso();
    const eventos: EventoCola["tipo"][] = [];
    const { resultados, detenida } = await ejecutarCola(["1", "2", "3", "4", "5", "6", "7", "8"], {
      tarea: (_i, pedir) =>
        pedir(async () => {
          throw fallaRed();
        }),
      alFallar: (i, e) => `${i}:${e.tipo}`,
      onEvento: (e) => eventos.push(e.tipo),
      ritmo: { reintentos: 0 },
      entorno,
    });

    expect(esperas).toContain(60000);
    expect(eventos).toEqual(["pausa", "reanudada", "detenida"]);
    expect(detenida).toBe(true);
    // todos los radicados tienen resultado, aunque no se hayan consultado
    expect(resultados).toHaveLength(8);
  });

  it("al cancelar marca el resto como cancelado", async () => {
    const { entorno } = entornoFalso();
    const control = new AbortController();
    const { resultados } = await ejecutarCola(["a", "b", "c"], {
      tarea: async (item, pedir) => {
        const r = await pedir(async () => item);
        if (item === "a") control.abort();
        return r;
      },
      alFallar: (i, e) => `${i}:${e.tipo}`,
      signal: control.signal,
      entorno,
    });
    expect(resultados).toEqual(["a", "b:cancelado", "c:cancelado"]);
  });
});
