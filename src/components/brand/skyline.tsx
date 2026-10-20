import { seeded } from "@/lib/seeded";
import { cn } from "@/lib/utils";

/**
 * The living skyline: layered ridges with pines under a sun and clouds by day, or
 * stars and a crescent moon by night. `variant="auto"` renders the day scene in
 * light mode and the night scene in dark mode (both are in the DOM, CSS picks one).
 *
 * Server component. Stars are seeded so SSR and hydration agree. Sized by the
 * parent: give it `absolute inset-0` or a fixed box.
 *
 * - `hero`  800×400 viewBox, cropped from the centre on narrow screens
 * - `card`  400×200, the event-card fallback when there is no poster
 * - `strip` 400×100 ridges only, stretched to fit (footers, dividers)
 */
export type SkylineVariant = "auto" | "day" | "night";
export type SkylineSize = "hero" | "card" | "strip";

export function Skyline({
  variant = "auto",
  size = "card",
  seed = "base-camp",
  animated = true,
  className,
}: {
  variant?: SkylineVariant;
  size?: SkylineSize;
  seed?: string;
  animated?: boolean;
  className?: string;
}) {
  if (variant === "auto") {
    return (
      <>
        <Scene mode="day" size={size} seed={seed} animated={animated} className={cn("dark:hidden", className)} />
        <Scene mode="night" size={size} seed={seed} animated={animated} className={cn("hidden dark:block", className)} />
      </>
    );
  }
  return <Scene mode={variant} size={size} seed={seed} animated={animated} className={className} />;
}

const DAY = { sky: ["#3cc5e8", "#cdeefa"], far: "#8cc63e", mid: "#39b54a", near: "#1f9a3e", pine: "#1b5e3b" };
const NIGHT = { sky: ["#0b161a", "#1f4a5c"], far: "#244d3a", mid: "#17422f", near: "#0b3d2e", pine: "#0b3d2e" };

function Scene({ mode, size, seed, animated, className }: { mode: "day" | "night"; size: SkylineSize; seed: string; animated: boolean; className?: string }) {
  const c = mode === "day" ? DAY : NIGHT;
  const id = `sl-${mode}-${size}-${seed.replace(/[^a-z0-9]/gi, "")}`;

  if (size === "strip") {
    return (
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden className={cn("block h-full w-full", className)}>
        <path d="M0 100V60L60 34L120 58L190 22L260 56L320 36L400 62V100Z" fill={c.far} opacity={mode === "day" ? 0.55 : 0.8} />
        <path d="M0 100V78L70 66L150 86L230 62L310 80L400 68V100Z" fill={c.mid} opacity={mode === "day" ? 0.55 : 0.9} />
      </svg>
    );
  }

  // Both compositions share a 2:1 viewBox; hero doubles the coordinates so the
  // sun and moon sit inside the crop a 390px-wide phone keeps (x 125–675 of 800).
  const W = size === "hero" ? 800 : 400;
  const H = W / 2;
  const s = W / 400;
  const sunX = size === "hero" ? 200 : 64;
  const sunY = size === "hero" ? 100 : 54;
  const moonX = size === "hero" ? 600 : 330;
  const moonY = size === "hero" ? 90 : 50;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden className={cn("block h-full w-full", className)}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sky[0]} />
          <stop offset="1" stopColor={c.sky[1]} />
        </linearGradient>
        {mode === "night" && (
          <mask id={`${id}-moon`}>
            <rect width={W} height={H} fill="#fff" />
            <circle cx={moonX + 9 * s} cy={moonY - 6 * s} r={16 * s} fill="#000" />
          </mask>
        )}
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />

      {mode === "day" ? (
        <>
          <circle cx={sunX} cy={sunY} r={17 * s} fill="#f7e017" />
          <circle cx={sunX} cy={sunY} r={25 * s} fill="none" stroke="#f7e017" strokeWidth={2 * s} strokeDasharray={`${4 * s} ${7 * s}`} />
          <g fill="#ffffff" opacity={0.92} className={animated ? "animate-drift" : undefined} style={{ transformOrigin: "center" }}>
            <ellipse cx={290 * s} cy={64 * s} rx={36 * s} ry={11 * s} />
            <ellipse cx={306 * s} cy={55 * s} rx={20 * s} ry={12 * s} />
            <ellipse cx={274 * s} cy={58 * s} rx={16 * s} ry={9 * s} />
            <ellipse cx={150 * s} cy={42 * s} rx={22 * s} ry={7 * s} />
            <ellipse cx={160 * s} cy={37 * s} rx={12 * s} ry={7 * s} />
          </g>
        </>
      ) : (
        <>
          <Stars w={W} h={H} seed={seed} animated={animated} />
          <circle cx={moonX} cy={moonY} r={18 * s} fill="#f5f0a0" mask={`url(#${id}-moon)`} />
        </>
      )}

      <path d={scale("M0 200V128L48 86L96 122L158 54L214 118L262 92L320 138L368 104L400 126V200Z", s)} fill={c.far} />
      <path d={scale("M0 200V158L52 136L118 164L186 112L254 160L318 138L400 172V200Z", s)} fill={c.mid} />
      <g fill={c.pine}>
        {PINES.map(([x, y], i) => (
          <path key={i} d={pine(x * s, y * s, s)} />
        ))}
      </g>
      <path d={scale("M0 200V186L72 172L150 192L232 168L312 186L400 174V200Z", s)} fill={c.near} />
    </svg>
  );
}

/** Pine positions along the middle ridge, in 400×200 units. */
const PINES: [number, number][] = [
  [40, 160],
  [60, 156],
  [200, 136],
  [218, 142],
  [300, 158],
  [332, 160],
  [380, 180],
];

function pine(x: number, y: number, s: number) {
  const a = 7 * s, b = 18 * s, c = 5 * s, d = 13 * s, up = 10 * s;
  return `M${x} ${y}l-${a} ${b}h${2 * a}z M${x} ${y - up}l-${c} ${d}h${2 * c}z`;
}

/** Multiplies every number in a simple M/V/L path by `s`. */
function scale(d: string, s: number) {
  return s === 1 ? d : d.replace(/-?\d+(\.\d+)?/g, (n) => String(Math.round(Number(n) * s * 100) / 100));
}

function Stars({ w, h, seed, animated }: { w: number; h: number; seed: string; animated: boolean }) {
  const rnd = seeded(seed);
  const stars: { x: number; y: number; r: number; o: number; d: number }[] = [];
  const n = Math.round((w / 400) * 22);
  for (let i = 0; i < n; i++) {
    // keep the sky clear of the ridge line (lower third)
    stars.push({ x: rnd() * w, y: rnd() * h * 0.62, r: 0.8 + rnd() * 1.2, o: 0.45 + rnd() * 0.55, d: rnd() * 3 });
  }
  return (
    <g fill="#f5f0a0">
      {stars.map((st, i) => (
        <circle
          key={i}
          cx={st.x.toFixed(1)}
          cy={st.y.toFixed(1)}
          // grow sub-linearly: the hero is already scaled up to fill a desktop, and full-size stars read as dots
          r={(st.r * Math.sqrt(w / 400)).toFixed(1)}
          opacity={st.o.toFixed(2)}
          className={animated && i % 3 === 0 ? "animate-twinkle" : undefined}
          style={animated && i % 3 === 0 ? { animationDelay: `${st.d.toFixed(2)}s` } : undefined}
        />
      ))}
    </g>
  );
}

/** A tent under the ridge, for empty states. */
export function CampIllustration({ className }: { className?: string }) {
  return (
    <>
      <svg viewBox="0 0 200 90" aria-hidden className={cn("dark:hidden", className)}>
        <circle cx="40" cy="26" r="11" fill="#f7e017" />
        <path d="M0 90V58L36 34L70 56L112 24L150 52L186 38L200 46V90Z" fill="#8cc63e" />
        <path d="M0 90V72L50 62L100 80L150 60L200 74V90Z" fill="#39b54a" />
        <path d="M112 86 140 46l28 40h-56Z" fill="#f6f4ec" stroke="#1b5e3b" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M140 46v40" stroke="#1b5e3b" strokeWidth="2.5" />
        <path d="M130 86h20l-10-18z" fill="#1b5e3b" />
      </svg>
      <svg viewBox="0 0 200 90" aria-hidden className={cn("hidden dark:block", className)}>
        <g fill="#f5f0a0">
          <circle cx="14" cy="14" r="1.3" />
          <circle cx="90" cy="10" r="1.5" />
          <circle cx="130" cy="20" r="1" />
          <circle cx="176" cy="12" r="1.4" />
          <circle cx="160" cy="30" r="1" />
        </g>
        {/* the r11 moon at (40,26) less an r9 bite at (46,20), as a path: a mask id would clash when several empties share a page */}
        <path d="M38.44 15.11A11 11 0 1 0 50.89 27.56A9 9 0 0 1 38.44 15.11Z" fill="#f5f0a0" />
        <path d="M0 90V58L36 34L70 56L112 24L150 52L186 38L200 46V90Z" fill="#244d3a" />
        <path d="M0 90V72L50 62L100 80L150 60L200 74V90Z" fill="#17422f" />
        <path d="M112 86 140 46l28 40h-56Z" fill="#1c2f34" stroke="#8cc63e" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M140 46v40" stroke="#8cc63e" strokeWidth="2.5" />
        <path d="M130 86h20l-10-18z" fill="#f5f0a0" />
      </svg>
    </>
  );
}
