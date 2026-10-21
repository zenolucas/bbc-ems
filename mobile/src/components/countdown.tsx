import { fmtLeft } from "@bbc/shared/format";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "@/components/ui";
import { useTheme } from "@/theme";

/** The current time, refreshed every `everyMs`: Date.now() can't be called during render. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Milliseconds left until `to`, ticking every `everyMs`. Calls `onDone` once when it hits zero. */
export function useCountdown(to: string | null | undefined, onDone?: () => void, everyMs = 15_000) {
  const target = to ? new Date(to).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    if (target == null) return;
    // Tick each second for the last two minutes so "<1m" doesn't sit still
    const left = target - Date.now();
    if (left <= 0) return;
    const t = setTimeout(() => setNow(Date.now()), left < 120_000 ? 1000 : Math.min(everyMs, left));
    return () => clearTimeout(t);
  }, [target, everyMs, now]);
  const left = target == null ? null : Math.max(0, target - now);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [left, onDone]);
  return left;
}

/** "Resubmit within 20h 05m" style text. */
export function CountdownText({ to, prefix = "", done = "Time's up", onDone, color }: { to: string; prefix?: string; done?: string; onDone?: () => void; color?: string }) {
  const left = useCountdown(to, onDone);
  return (
    <Text variant="label" color={color}>
      {left === 0 ? done : `${prefix}${fmtLeft(left ?? 0)}`}
    </Text>
  );
}

/** The hold ring: how much of the hold is left, with the time in the middle. */
export function CountdownRing({ to, from, onDone, size = 64 }: { to: string; from: string; onDone?: () => void; size?: number }) {
  const { c } = useTheme();
  const left = useCountdown(to, onDone) ?? 0;
  const total = Math.max(1, new Date(to).getTime() - new Date(from).getTime());
  const frac = Math.min(1, left / total);
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const tone = frac < 0.15 ? c.destructive : frac < 0.4 ? c.warning : c.info;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible accessibilityLabel={`${fmtLeft(left)} left on your hold`}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface3} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} fill="none" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - frac)} strokeLinecap="round" />
      </Svg>
      <Text variant="label" maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12, paddingHorizontal: 6 }}>{fmtLeft(left)}</Text>
    </View>
  );
}
