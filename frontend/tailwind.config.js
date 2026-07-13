/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta baseada na logo da E Tenho Ditto (verde sálvia + preto)
        brand: {
          50: "#f2f8f2",
          100: "#dfeee0",
          200: "#b9dabb",
          300: "#94c797",
          400: "#7fb883",
          500: "#6aa66e", // verde principal (tom da logo)
          600: "#548557",
          700: "#3f6442",
          800: "#2a432c",
          900: "#162216",
        },
        accent: {
          50: "#fdf3ee",
          100: "#fbe3d6",
          200: "#f5c1a3",
          300: "#ef9e70",
          400: "#e97c3d",
          500: "#d95f20", // laranja queimado - CTA / preços / destaque
          600: "#b04a19",
          700: "#873713",
          800: "#5e250d",
          900: "#361507",
        },
        ink: "#1b1b1b",
      },
      fontFamily: {
        display: ["'Poppins'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        serif: ["'Playfair Display'", "serif"],
      },
      boxShadow: {
        card: "0 4px 20px -4px rgba(0,0,0,0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-in-up": "slideInUp 0.4s ease-out",
        "slide-in-down": "slideInDown 0.4s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "bounce-sm": "bounce-sm 1s infinite",
        "glow": "glow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInDown: {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "bounce-sm": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        glow: {
          "0%, 100%": { "box-shadow": "0 0 5px rgba(217, 95, 32, 0.5)" },
          "50%": { "box-shadow": "0 0 20px rgba(217, 95, 32, 0.8)" },
        },
      },
    },
  },
  plugins: [],
};
