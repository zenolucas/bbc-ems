import { EVENT_CATEGORY_LABELS, type EventSummaryDTO } from "@bbc/shared/api-types";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { EventCard, PastEventRow } from "@/components/event/event-card";
import { Button, EmptyState, ErrorView, Loading, Notice, Screen, Text } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useEvents } from "@/lib/attendee";
import { useSession } from "@/lib/session";
import { fonts, radius, space, useTheme } from "@/theme";

/** The site's home filters: All / Gigs / Outdoors / Free ("Free" means every tier is free). */
type Filter = "all" | "gig" | "outdoors" | "free";

const FILTERS: { key: Filter; label: string; match: (e: EventSummaryDTO) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "gig", label: EVENT_CATEGORY_LABELS.gig, match: (e) => e.category === "gig" },
  { key: "outdoors", label: EVENT_CATEGORY_LABELS.outdoors, match: (e) => e.category === "outdoors" },
  { key: "free", label: "Free", match: (e) => e.priceFromCents === 0 },
];

const EMPTY: Record<Exclude<Filter, "all">, string> = {
  gig: "No gigs coming up",
  outdoors: "No hikes or outdoor trips coming up",
  free: "No free events coming up",
};

export default function EventsTab() {
  const { me } = useSession();
  const q = useEvents();
  const [filter, setFilter] = useState<Filter>("all");
  const first = me?.name?.split(" ")[0];

  const upcoming = q.data?.upcoming ?? [];
  // A pill only earns its place when it narrows the list without emptying it
  const pills = FILTERS.filter((f) => f.key === "all" || (upcoming.some(f.match) && !upcoming.every(f.match)));
  const active = pills.some((p) => p.key === filter) ? filter : "all";
  const shown = upcoming.filter(FILTERS.find((f) => f.key === active)!.match);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: "Events" }} />
      <View style={{ gap: 4, marginBottom: space.sm }}>
        <Text variant="caption" muted style={{ letterSpacing: 1.2 }}>BAGUIO BASE CAMP</Text>
        <Text variant="display">{first ? `Hey ${first}, what's on` : "What's on"}</Text>
      </View>

      {q.isPending ? (
        <Loading />
      ) : q.isError && !q.data ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {q.isError && q.error instanceof ApiError && q.error.offline && <Notice title="You're offline" tone="warning">Showing the last list we loaded. Pull down to try again.</Notice>}
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled yet">New gigs and hikes show up here first. Pull down to check again.</EmptyState>
          ) : (
            <>
              <Text variant="heading">Coming up</Text>
              {pills.length > 1 && <FilterRow pills={pills} active={active} onChange={setFilter} />}
              {shown.length === 0 && active !== "all" ? (
                <EmptyState title={EMPTY[active]} action={<Button title="Show everything" variant="secondary" onPress={() => setFilter("all")} />} />
              ) : (
                shown.map((e) => <EventCard key={e.id} e={e} />)
              )}
            </>
          )}
          {q.data!.past.length > 0 && (
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Text variant="heading">Past events</Text>
              {q.data!.past.map((e) => <PastEventRow key={e.id} e={e} />)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function FilterRow({ pills, active, onChange }: { pills: typeof FILTERS; active: Filter; onChange: (f: Filter) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} accessibilityRole="tablist" style={{ flexGrow: 0 }}>
      {pills.map((p) => {
        const on = p.key === active;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? c.primary : c.surface1, borderColor: on ? c.primary : c.border }]}
          >
            <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? c.primaryForeground : c.foreground }}>{p.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 38, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
