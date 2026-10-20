"use client";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean) {
  muted = v;
}

function tone(freq: number, ms: number, when = 0, type: OscillatorType = "sine") {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.2;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime + when;
    o.start(t);
    o.stop(t + ms / 1000);
  } catch {
    /* audio blocked */
  }
}

export type FeedbackKind = "ok" | "duplicate" | "invalid" | "void" | "warn";

export function feedback(kind: FeedbackKind) {
  if (kind === "ok") {
    tone(880, 90);
    tone(1320, 140, 0.1);
    navigator.vibrate?.(60);
  } else if (kind === "duplicate" || kind === "warn") {
    tone(520, 160, 0, "triangle");
    tone(520, 160, 0.2, "triangle");
    navigator.vibrate?.([80, 60, 80]);
  } else {
    tone(200, 350, 0, "sawtooth");
    navigator.vibrate?.([120, 60, 120, 60, 120]);
  }
}

/** Unlock audio on first user gesture (iOS). */
export function primeAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}
