// lib/compartir.ts
// Compartir y copiar con respaldo: Chrome/Edge no permiten compartir .xlsx,
// Safari exige compartir dentro del gesto del usuario, y en http (sin https)
// no existen navigator.share ni navigator.clipboard.

import { ETIQUETA_ESTADO, legible } from "./estados";
import { ordenarResultados } from "./excel/comparar";
import type { ResultadoBloque } from "./tipos";

/** Copia texto; si el portapapeles moderno no está disponible usa execCommand. */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // continúa con el método antiguo
    }
  }
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

const recortar = (s: string, max = 120) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const MAX_PROCESOS_EN_RESUMEN = 25;

/** Resumen en texto plano, pensado para WhatsApp o correo. */
export function resumenTexto(resultados: ResultadoBloque[], fecha: string): string {
  const cambios = ordenarResultados(resultados).filter((r) => r.estado === "cambio" || r.estado === "nuevo");
  const lineas = [`*Black Shark* · Revisión del ${fecha}`];

  if (cambios.length === 0) {
    lineas.push("", "Ningún proceso cambió de status.");
  } else {
    lineas.push("", `${cambios.length} proceso(s) con status nuevo:`);
    for (const r of cambios.slice(0, MAX_PROCESOS_EN_RESUMEN)) {
      const juzgado = r.bloque.juzgado || r.despacho;
      lineas.push(
        "",
        `• ${r.bloque.radicadoCrudo}${juzgado ? ` — ${recortar(juzgado, 60)}` : ""}`,
        ...(r.statusAnterior ? [`  Antes: ${recortar(legible(r.statusAnterior))}`] : []),
        `  Ahora: ${recortar(legible(r.statusActual))}`
      );
    }
    if (cambios.length > MAX_PROCESOS_EN_RESUMEN) {
      lineas.push("", `…y ${cambios.length - MAX_PROCESOS_EN_RESUMEN} más en el Excel.`);
    }
  }

  const conteo = new Map<string, number>();
  for (const r of resultados) {
    if (r.estado === "cambio" || r.estado === "nuevo") continue;
    const e = ETIQUETA_ESTADO[r.estado];
    conteo.set(e, (conteo.get(e) ?? 0) + 1);
  }
  if (conteo.size) lineas.push("", [...conteo].map(([e, n]) => `${e}: ${n}`).join(" · "));
  return lineas.join("\n");
}
