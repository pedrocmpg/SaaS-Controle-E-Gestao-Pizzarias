/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade "forno a lenha": carvão + fogo-ember, dourado como detalhe
        char: "#201A16",
        ember: {
          50: "#fdf0ec",
          100: "#fad9cd",
          200: "#f0af98",
          300: "#e58362",
          400: "#da5b38",
          500: "#D2401F", // única cor de CTA/ação do site
          600: "#A8321A", // hover dos botões ember
          700: "#802616",
          800: "#571a10",
          900: "#2e0d08",
        },
        melt: "#E8A33D",
        flour: {
          DEFAULT: "#FAF6F0",
          2: "#F1E9DD",
        },
        basil: "#4C6B3C",
        ink: {
          DEFAULT: "#2B2521",
          soft: "#6E655C",
        },
        // Mantidos por compatibilidade com classes existentes (brand/accent),
        // repontados para a nova paleta
        brand: {
          50: "#F1E9DD",
          100: "#F1E9DD",
          200: "#E8A33D",
          300: "#E8A33D",
          400: "#4C6B3C",
          500: "#4C6B3C",
          600: "#4C6B3C",
          700: "#201A16",
          800: "#201A16",
          900: "#201A16",
        },
        accent: {
          50: "#fdf0ec",
          100: "#fad9cd",
          200: "#f0af98",
          300: "#e58362",
          400: "#da5b38",
          500: "#D2401F",
          600: "#A8321A",
          700: "#802616",
          800: "#571a10",
          900: "#2e0d08",
        },
        // Aliases semânticos pro StatusBadge e feedback visual em geral —
        // um lugar único pra mudar a cor de cada significado (spec-4).
        // Não são preparação pra dark mode, só evitam hex solto nos componentes.
        success: {
          50: "#EEF3EA",
          100: "#DCE7D5",
          500: "#4C6B3C", // = basil
          700: "#374F2B",
        },
        warning: {
          50: "#FDF3E3",
          100: "#FBE7C7",
          500: "#E8A33D", // = melt
          700: "#B87C22",
        },
        danger: {
          50: "#FDECEC",
          100: "#FBD5D5",
          500: "#D23838",
          700: "#A12727",
        },
        neutral: {
          50: "#F5F4F2",
          100: "#E9E7E3",
          500: "#8A8178",
          700: "#57504A",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        serif: ["'Fraunces'", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        card: "none",
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
          "0%, 100%": { "box-shadow": "0 0 5px rgba(210, 64, 31, 0.5)" },
          "50%": { "box-shadow": "0 0 20px rgba(210, 64, 31, 0.8)" },
        },
      },
    },
  },
  plugins: [],
};
