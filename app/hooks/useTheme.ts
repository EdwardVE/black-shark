// hooks/useTheme.ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

// El tema vive en la clase .dark de <html>, que el script de layout.tsx
// aplica antes de pintar. Este hook solo la observa y la cambia.
function suscribir(onCambio: () => void) {
  const observador = new MutationObserver(onCambio);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observador.disconnect();
}

const leerTema = () => document.documentElement.classList.contains("dark");

export function useTheme() {
  const isDark = useSyncExternalStore(suscribir, leerTema, () => false);

  const toggleTheme = useCallback(() => {
    const raiz = document.documentElement;
    const nuevoIsDark = !raiz.classList.contains("dark");
    raiz.classList.toggle("dark", nuevoIsDark);
    raiz.style.colorScheme = nuevoIsDark ? "dark" : "light";
    try {
      localStorage.setItem("theme", nuevoIsDark ? "dark" : "light");
    } catch {
      // Sin almacenamiento (modo privado): el tema dura solo esta visita.
    }
  }, []);

  return { isDark, toggleTheme };
}
