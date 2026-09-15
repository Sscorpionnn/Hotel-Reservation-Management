import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6fc",
          100: "#e2ebf7",
          200: "#c3d7ef",
          300: "#94b8e0",
          400: "#5c92cc",
          500: "#3a72b3",
          600: "#2a5896",
          700: "#234779",
          800: "#213c65",
          900: "#1f3455",
          950: "#141f36",
        },
      },
    },
  },
  plugins: [],
};

export default config;
