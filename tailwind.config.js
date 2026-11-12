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
        ink: { 950: "#070B14", 900: "#0B1220", 800: "#101A30" },
      },
      boxShadow: {
        glow: "0 10px 40px -10px rgba(37, 99, 235, 0.55)",
        "glow-green": "0 10px 40px -10px rgba(16, 185, 129, 0.55)",
        "glow-rose": "0 10px 40px -10px rgba(225, 29, 72, 0.45)",
      },
    },
  },
  plugins: [],
};
