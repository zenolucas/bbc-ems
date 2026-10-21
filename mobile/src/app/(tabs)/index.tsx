import { Stack } from "expo-router";
import { View } from "react-native";
import { EventCard, PastEventRow } from "@/components/event/event-card";
import { EmptyState, ErrorView, Loading, Notice, Screen, Text } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useEvents } from "@/lib/attendee";
import { useSession } from "@/lib/session";
import { space } from "@/theme";

export default function EventsTab() {
  const { me } = useSession();
  const q = useEvents();
  const first = me?.name?.split(" ")[0];

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
          {q.data!.upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled yet">New gigs and hikes show up here first. Pull down to check again.</EmptyState>
          ) : (
            <>
              <Text variant="heading">Coming up</Text>
              {q.data!.upcoming.map((e) => <EventCard key={e.id} e={e} />)}
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
