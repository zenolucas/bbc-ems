import { cn } from "@/lib/utils";

/*
 * Scenes for the lost (404) and broken (error) states, drawn on the same ridge as
 * <CampIllustration> so the three read as a set. Each has a day and a night copy;
 * CSS shows the one that matches the theme. No ids inside, so any number can
 * share a page.
 */

const DAY = { far: "#8cc63e", near: "#39b54a", ink: "#1b5e3b" };
const NIGHT = { far: "#244d3a", near: "#17422f", ink: "#8cc63e" };

function Sky({ night }: { night: boolean }) {
  if (!night) return <circle cx="40" cy="26" r="11" fill="#f7e017" />;
  return (
    <>
      <g fill="#f5f0a0">
        <circle cx="14" cy="14" r="1.3" />
        <circle cx="90" cy="10" r="1.5" />
        <circle cx="130" cy="20" r="1" />
        <circle cx="176" cy="12" r="1.4" />
        <circle cx="160" cy="30" r="1" />
      </g>
      {/* crescent: the moon with a bite of card colour taken out */}
      <circle cx="40" cy="26" r="11" fill="#f5f0a0" />
      <circle cx="46" cy="20" r="9" className="fill-card" />
    </>
  );
}

function Ridges({ c }: { c: typeof DAY }) {
  return (
    <>
      <path d="M0 90V58L36 34L70 56L112 24L150 52L186 38L200 46V90Z" fill={c.far} />
      <path d="M0 90V72L50 62L100 80L150 60L200 74V90Z" fill={c.near} />
    </>
  );
}

/** "We couldn't find that trail": a compass with a leaf where the tent would be. */
export function LostIllustration({ className }: { className?: string }) {
  return (
    <>
      {[false, true].map((night) => {
        const c = night ? NIGHT : DAY;
        return (
          <svg key={String(night)} viewBox="0 0 200 90" aria-hidden className={cn(night ? "hidden dark:block" : "dark:hidden", className)}>
            <Sky night={night} />
            <Ridges c={c} />
            <circle cx="140" cy="58" r="17" className="fill-card" fillOpacity={night ? 0.35 : 0.85} stroke={c.ink} strokeWidth="2.5" />
            <path d="M132 66c0-11 7-16 16-15 1 9-5 15-16 15Z" fill={c.ink} />
            <path d="M132 66l10-9" stroke={night ? "#1c2f34" : "#ffffff"} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      })}
    </>
  );
}

/** "Something went wrong": the tent, knocked red, with a cross beside it. */
export function BrokenIllustration({ className }: { className?: string }) {
  return (
    <>
      {[false, true].map((night) => {
        const c = night ? NIGHT : DAY;
        const red = night ? "#ff8a76" : "#b4321f";
        return (
          <svg key={String(night)} viewBox="0 0 200 90" aria-hidden className={cn(night ? "hidden dark:block" : "dark:hidden", className)}>
            <Sky night={night} />
            <Ridges c={c} />
            <path d="M112 86 140 46l28 40h-56Z" fill={night ? "#1c2f34" : "#f6f4ec"} stroke={red} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M140 46v40" stroke={red} strokeWidth="2.5" />
            <path d="M130 86h20l-10-18z" fill={red} />
            <path d="M60 18l12 14M72 18 60 32" stroke={red} strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
      })}
    </>
  );
}
