// components/InsigniaEstado.tsx
import { CLASES_ESTADO, ETIQUETA_ESTADO } from "../lib/estados";
import type { Estado } from "../lib/tipos";

export default function InsigniaEstado({ estado }: { estado: Estado }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${CLASES_ESTADO[estado]}`}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
