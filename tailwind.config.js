/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          /**
           * RoadAxis orange as *text*, which is a different value from RoadAxis
           * orange as a *fill*.
           *
           * #FF7A00 measures 2.61:1 against white — it fails AA outright — and
           * 6.86:1 against the brand's own ink. So the fill token is used behind
           * ink-coloured text, and this darker value is used when the orange
           * itself has to be the ink. They are not interchangeable and the
           * contrast test in e2e asserts it. See DESIGN.md, "The orange rule".
           */
          text: "hsl(var(--primary-text))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          /**
           * Amber as *text on a tinted ground*, the same idea as
           * `primary.text`. The badge paints its own colour at 10% behind the
           * label, and the full-strength amber measured 3.64:1 against that.
           */
          text: "hsl(var(--warning-text))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundColor: {
        "surface-2": "hsl(var(--surface-2))",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      /**
       * Interface in Inter Tight, data in IBM Plex Mono. See DESIGN.md.
       *
       * `mono` is declared explicitly and deliberately. Left undeclared it falls
       * through to Tailwind's default stack — Consolas on Windows, Menlo on
       * macOS, something else on Linux — and every distance, rating and phone
       * number renders differently on every machine, in a product whose cards
       * are read as columns of figures.
       *
       * Inter Tight rather than Inter: a real UK business name ("Bridgewater
       * Tyre & Exhaust Centre") has to fit a 390px card without wrapping to
       * three lines, and that card is the most-repeated element in the product.
       */
      fontFamily: {
        /**
         * Instrument Sans for the interface, Bricolage Grotesque for headings.
         *
         * Not Inter, and that is the point. Inter — and its close relations — is
         * the default face of every AI-generated page of 2026; a product set in it
         * is read as a template before a single word is understood. Instrument
         * Sans has the same neutrality in the body without the fingerprint, and
         * Bricolage carries an optical-size axis so a display heading gets tight
         * counters and a caption gets open ones — the difference between type
         * that was set and type that was scaled.
         */
        sans: ['"Instrument Sans"', "system-ui", "-apple-system", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"Instrument Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      /**
       * Overlays only.
       *
       * A fade-and-rise on page mount is the most common tell in generated
       * interfaces and costs ~200ms before the first content is readable — on
       * the public side over a roadside connection that is already slow, and on
       * the portal side on a screen someone opens forty times a day.
       */
      keyframes: {
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        "overlay-in": "overlay-in 120ms ease-out",
        "sheet-up": "sheet-up 180ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
