import type { Manifest, ManifestTicket } from "@bbc/shared/scan-types";
import { fmtTime } from "@bbc/shared/format";
import { Check, Search } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui";
import { fonts, nightTheme, radius, space } from "@/theme";
import { highlightParts, matchGuests, type LocalUsed } from "./logic";

const c = nightTheme.c;
const LIMIT = 200;

function Highlight({ text, q, style }: { text: string; q: string; style?: object }) {
  return (
    <Text theme={nightTheme} style={style} numberOfLines={1}>
      {highlightParts(text, q).map((p, i) =>
        p.hit ? (
          <Text key={i} theme={nightTheme} style={[style, { backgroundColor: c.warningSoft }]}>{p.text}</Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}

/**
 * Search the downloaded list and check someone in by hand. Every check-in asks
 * for a second tap on the same row, so a slip of the thumb doesn't burn a ticket.
 * Rendered inside the door screen's scroll view, so rows are mapped, capped at 200.
 */
export function GuestList({ manifest, localUsed, onCheckin }: { manifest: Manifest | null; localUsed: LocalUsed; onCheckin: (code: string) => void }) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const all = useMemo(() => manifest?.tickets ?? [], [manifest]);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => matchGuests(all, query), [all, query]);
  const shown = matches.slice(0, LIMIT);
  const live = all.filter((t) => t.status !== "void");
  const notIn = live.filter((t) => t.status === "valid" && !localUsed[t.id]).length;

  return (
    <View style={styles.card}>
      <View style={styles.searchWrap}>
        <Search size={18} color={c.mutedForeground} style={{ position: "absolute", left: 14 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name, code or tier"
          placeholderTextColor={c.mutedForeground}
          autoCorrect={false}
          autoComplete="off"
          accessibilityLabel="Search guests"
          style={styles.search}
        />
      </View>
      {manifest && (
        <View style={styles.counts} accessibilityLiveRegion="polite">
          <Text theme={nightTheme} variant="caption" muted>{q ? `${matches.length} of ${live.length} match` : `${live.length} guest${live.length === 1 ? "" : "s"}`}</Text>
          <Text theme={nightTheme} variant="caption" muted>{notIn} not in yet</Text>
        </View>
      )}
      <View>
        {shown.map((t, i) => (
          <GuestRow
            key={t.id}
            t={t}
            first={i === 0}
            q={q}
            usedAt={t.status === "used" ? t.checkedInAt : localUsed[t.id] ?? null}
            used={t.status === "used" || !!localUsed[t.id]}
            confirming={confirming === t.id}
            onAsk={() => setConfirming(t.id)}
            onCancel={() => setConfirming(null)}
            onConfirm={() => {
              setConfirming(null);
              onCheckin(t.code);
            }}
          />
        ))}
        {shown.length === 0 && (
          <Text theme={nightTheme} muted style={{ textAlign: "center", paddingVertical: space.xl }}>{manifest ? "No matches" : "Ticket list not loaded"}</Text>
        )}
      </View>
      {matches.length > shown.length && (
        <Text theme={nightTheme} variant="caption" muted style={{ textAlign: "center" }}>Showing the first {shown.length}. Search to narrow it down.</Text>
      )}
      <Text theme={nightTheme} variant="caption" muted style={{ textAlign: "center", paddingTop: 10 }}>
        Checking in from the list asks you to confirm, so a slip of the thumb doesn&apos;t burn a ticket.
      </Text>
    </View>
  );
}

const GuestRow = memo(function GuestRow({
  t,
  first,
  q,
  used,
  usedAt,
  confirming,
  onAsk,
  onCancel,
  onConfirm,
}: {
  t: ManifestTicket;
  first: boolean;
  q: string;
  used: boolean;
  usedAt: string | null;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isVoid = t.status === "void";
  const isConfirming = confirming && t.status === "valid" && !used;
  return (
    <View
      style={[
        styles.row,
        !first && !isConfirming && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
        isConfirming && styles.rowConfirming,
        isVoid && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Highlight text={t.holder} q={q} style={[styles.name, isVoid && { textDecorationLine: "line-through" }]} />
        <Text theme={nightTheme} variant="caption" muted numberOfLines={1}>
          {highlightParts(t.tier, q).map((p, i) => (p.hit ? <Text key={i} theme={nightTheme} variant="caption" muted style={{ backgroundColor: c.warningSoft }}>{p.text}</Text> : p.text))}
          {" · "}
          <Text theme={nightTheme} variant="caption" muted style={{ fontFamily: fonts.mono }}>{t.code}</Text>
        </Text>
      </View>
      {isVoid ? (
        <Text theme={nightTheme} variant="label" color={c.destructive} style={{ fontSize: 12 }}>Voided</Text>
      ) : used ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Check size={12} color={c.mutedForeground} strokeWidth={2.4} />
          <Text theme={nightTheme} variant="caption" muted>In{usedAt ? ` · ${fmtTime(usedAt)}` : ""}</Text>
        </View>
      ) : isConfirming ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.btn, { paddingHorizontal: 12 }]}>
            <Text theme={nightTheme} variant="label" muted>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Confirm check-in for ${t.holder}`} onPress={onConfirm} style={[styles.btn, { backgroundColor: c.primary }]}>
            <Text theme={nightTheme} variant="label" color={c.primaryForeground}>Confirm</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Check in ${t.holder}`} onPress={onAsk} style={[styles.btn, { borderWidth: 1, borderColor: c.border }]}>
          <Text theme={nightTheme} variant="label">Check in</Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: 6, borderRadius: 22, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: space.md },
  searchWrap: { justifyContent: "center" },
  search: { height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, paddingLeft: 42, paddingRight: 14, color: c.foreground, fontFamily: fonts.body, fontSize: 16 },
  counts: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, paddingTop: 4 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  rowConfirming: { marginHorizontal: -14, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface2 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  btn: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
});
