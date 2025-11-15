// components/ThemeToggle.tsx
import React from "react";

interface ThemeToggleProps {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, toggleTheme }) => (
  <button
    id="theme-toggle"
    onClick={toggleTheme}
    className="p-3 rounded-full bg-input-bg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-color transition duration-300 border border-border-color"
    aria-label="Alternar modo oscuro y claro"
  >
    {/* Icono del Sol (Modo Claro/Oculto) */}
    <svg
      id="sun-icon"
      className={`w-6 h-6 text-yellow-500 ${!isDark ? "hidden" : "block"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      ></path>
    </svg>
    {/* Icono de la Luna (Modo Oscuro/Oculto) */}
    <svg
      id="moon-icon"
      className={`w-6 h-6 text-gray-500 ${isDark ? "hidden" : "block"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      ></path>
    </svg>
  </button>
);

export default ThemeToggle;
