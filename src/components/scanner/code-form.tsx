"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const CODE_LEN = 8;

/** Formats as the user types: BBC-XXXX-XXXX. */
function formatCode(v: string) {
  const alnum = v.toUpperCase().replace(/[^0-9A-Z]/g, "");
  // Still typing the prefix itself ("B", "BB"): don't read it as the code yet
  if ("BBC".startsWith(alnum)) return alnum;
  const raw = alnum.replace(/^BBC/, "").slice(0, CODE_LEN);
  return `BBC-${raw.slice(0, 4)}${raw.length > 4 ? `-${raw.slice(4)}` : ""}`;
}

/** Characters typed after the BBC- prefix. */
const typed = (code: string) => (code.startsWith("BBC-") ? code.slice(4).replace(/-/g, "").length : 0);

/**
 * The code printed under the QR, typed in big mono with a progress row, and a
 * button that says how many characters are still missing.
 */
export function CodeForm({ onSubmit, inputRef }: { onSubmit: (code: string) => Promise<unknown>; inputRef: React.Ref<HTMLInputElement> }) {
  const [code, setCode] = useState("");
  const n = typed(code);
  const left = CODE_LEN - n;

  return (
    <form
      className="flex flex-col gap-3 rounded-[22px] bg-card px-4 py-[18px]"
      onSubmit={(e) => { e.preventDefault(); void onSubmit(code).then(() => setCode("")); }}
    >
      <label className="text-[13px] font-semibold" htmlFor="code">Code printed under the QR</label>
      <input
        id="code"
        ref={inputRef}
        value={code}
        onChange={(e) => setCode(formatCode(e.target.value))}
        placeholder="BBC-7K3M-PX2Q"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        inputMode="text"
        className="h-[60px] w-full min-w-0 rounded-[14px] border-2 border-input bg-background px-3 text-center font-mono text-[22px] font-bold tracking-[0.12em] text-foreground outline-none transition-[border-color,box-shadow] placeholder:font-semibold placeholder:text-muted-foreground/50 focus:border-primary focus:shadow-[0_0_0_4px_rgb(140_198_62/0.2)] min-[380px]:text-[26px] min-[380px]:tracking-[0.14em]"
      />
      <div className="flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: CODE_LEN }, (_, i) => (
          <span key={i} className={cn("h-1 w-2.5 rounded-sm transition-colors", i < n ? "bg-primary" : "bg-surface-2")} />
        ))}
      </div>
      <button
        type="submit"
        disabled={left > 0}
        className="flex min-h-13 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground outline-none transition-opacity hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {left > 0 ? `Check in · ${left} more character${left === 1 ? "" : "s"}` : "Check in"}
      </button>
      <p className="text-center text-xs text-muted-foreground">O and 0, I and 1 are treated the same. Dashes are optional.</p>
    </form>
  );
}
