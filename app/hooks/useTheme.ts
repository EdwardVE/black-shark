// hooks/useTheme.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(false);

  // 1. Inicialización del Tema
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const initialDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    setIsDark(initialDark);
    document.documentElement.classList.toggle("dark", initialDark);
  }, []);

  // 2. Función para alternar el tema
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      document.documentElement.classList.toggle("dark", newIsDark);
      localStorage.setItem("theme", newIsDark ? "dark" : "light");
      return newIsDark;
    });
  }, []);

  return { isDark, toggleTheme };
}
