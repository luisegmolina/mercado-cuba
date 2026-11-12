/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        // Mar: azules de mar y cielo para el tema fresco tropical.
        mar: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
          800: "#0c4a6e",
          900: "#082f49",
          950: "#082f49",
        },
        aqua: { 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2" },
        arena: "#FDF8EF",
        coral: "#FF6B4A",
        sol: "#FBBF24",
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(3, 105, 161, 0.18)",
        card: "0 4px 20px -6px rgba(3, 105, 161, 0.12)",
        glow: "0 10px 40px -10px rgba(8, 145, 178, 0.45)",
        "glow-green": "0 10px 40px -10px rgba(22, 163, 74, 0.45)",
        "glow-rose": "0 10px 40px -10px rgba(225, 29, 72, 0.35)",
      },
    },
  },
  plugins: [],
};
