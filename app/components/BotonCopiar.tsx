// components/BotonCopiar.tsx
"use client";

import { useState } from "react";
import { copiarTexto } from "../lib/compartir";

/** Copia texto al portapapeles (p. ej. las actuaciones nuevas para pegarlas en la matriz). */
export default function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "error">("listo");

  const copiar = async () => {
    setEstado((await copiarTexto(texto)) ? "copiado" : "error");
    setTimeout(() => setEstado("listo"), 2000);
  };

  return (
    <button
      type="button"
      onClick={copiar}
      className="min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {estado === "copiado" ? "¡Copiado!" : estado === "error" ? "No se pudo copiar" : etiqueta}
    </button>
  );
}
