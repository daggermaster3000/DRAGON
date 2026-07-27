/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#fcfcfb", page: "#f9f9f7" },
        ink: { DEFAULT: "#0b0b0b", soft: "#52514e", muted: "#898781" },
        hp: { good: "#0ca30c", warn: "#fab219", danger: "#d03b3b" },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "ui-monospace", "monospace"],
      },
      keyframes: {
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        excited: { "0%,100%": { transform: "translateY(0) rotate(0)" }, "25%": { transform: "translateY(-8px) rotate(-4deg)" }, "75%": { transform: "translateY(-8px) rotate(4deg)" } },
        sleepy: { "0%,100%": { transform: "scale(1,1)" }, "50%": { transform: "scale(1.02,0.96)" } },
        angry: { "0%,100%": { transform: "translateX(0)" }, "25%": { transform: "translateX(-3px)" }, "75%": { transform: "translateX(3px)" } },
        flash: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.55" } },
      },
      animation: {
        bob: "bob 2.6s ease-in-out infinite",
        excited: "excited 0.6s ease-in-out infinite",
        sleepy: "sleepy 3.5s ease-in-out infinite",
        angry: "angry 0.35s ease-in-out infinite",
        flash: "flash 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
