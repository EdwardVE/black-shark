// components/ThemeToggle.tsx
"use client";

import React from "react";
import { useTheme } from "../hooks/useTheme";

// Los íconos se muestran con las variantes dark: de CSS, así el botón es
// correcto desde el primer pintado (sin esperar a React).
const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center justify-center size-11 rounded-full bg-surface-2 border border-border shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title="Cambiar tema"
    >
      {/* Sol: visible en modo oscuro */}
      <svg
        className="size-6 text-yellow-400 hidden dark:block"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      {/* Luna: visible en modo claro */}
      <svg
        className="size-6 text-muted block dark:hidden"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
};

export default ThemeToggle;
