import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Vibration } from "react-native";
import type { FeedbackKind } from "./logic";

/**
 * The door hears and feels each result, so eyes can stay on the guest:
 * a rising two-note chime for "welcome in", a double buzz for "already
 * scanned" or a warning, a low saw for anything refused. The tones are the web
 * scanner's WebAudio recipes rendered to WAV (assets/sounds).
 */

const SOURCES = {
  ok: require("../../assets/sounds/ok.wav"),
  warn: require("../../assets/sounds/warn.wav"),
  error: require("../../assets/sounds/error.wav"),
} as const;

let players: Partial<Record<keyof typeof SOURCES, AudioPlayer>> = {};
let muted = false;
let primed = false;

export function setMuted(v: boolean) {
  muted = v;
}

/** Loads the players once the door screen opens, so the first beep isn't late. */
export function primeAudio() {
  if (primed) return;
  primed = true;
  // Door phones are often on silent; the in-app mute is the volunteer's switch.
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => {});
  try {
    for (const key of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) players[key] = createAudioPlayer(SOURCES[key]);
  } catch {
    players = {};
  }
}

export function releaseAudio() {
  for (const p of Object.values(players)) {
    try {
      p?.release();
    } catch {}
  }
  players = {};
  primed = false;
}

function play(key: keyof typeof SOURCES) {
  if (muted) return;
  const p = players[key];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    /* audio unavailable */
  }
}

export function feedback(kind: FeedbackKind) {
  if (kind === "ok") {
    play("ok");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => Vibration.vibrate(60));
  } else if (kind === "duplicate" || kind === "warn") {
    play("warn");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => Vibration.vibrate([0, 80, 60, 80]));
  } else {
    play("error");
    // A longer, unmistakable pattern for refusals, like the web's 3-pulse vibrate
    Vibration.vibrate([0, 120, 60, 120, 60, 120]);
  }
}
