import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#1D5C3A",
          greenMid: "#2D7A4F",
          greenLight: "#4A9E6B",
          mint: "#A8D5B5",
          cream: "#F7F2EA",
          gold: "#C4963A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
