import type { ReviewItemDTO } from "@bbc/shared/admin-types";
import { peso, relative } from "@bbc/shared/format";
// Href casts: the generated route types only learn about /review on the next `expo start`
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { AlertTriangle, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Card, EmptyState, ErrorView, Loading, Row, Screen, SignInPrompt, Text } from "@/components/ui";
import { useReviewQueue } from "@/lib/review";
import { useSession } from "@/lib/session";
import { space, useTheme } from "@/theme";

/** Receipts waiting for an organiser, oldest first. ?eventId= narrows it to one event. */
export default function ReviewQueue() {
  const { status, isAdmin } = useSession();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const q = useReviewQueue(eventId);

  const title = <Stack.Screen options={{ title: "Review receipts" }} />;
  if (status !== "signedIn") {
    return (
      <Screen edges={["bottom"]} scroll={false}>
        {title}
        <SignInPrompt title="Sign in to review receipts">Organisers check GCash and Maya receipts here.</SignInPrompt>
      </Screen>
    );
  }
  if (!isAdmin) {
    return (
      <Screen edges={["bottom"]} scroll={false}>
        {title}
        <EmptyState title="Organisers only">Receipts are checked by the event organisers. Door crew scan tickets from the Door tab.</EmptyState>
      </Screen>
    );
  }
  if (q.isPending) return <>{title}<Loading /></>;
  if (q.isError && !q.data) return <>{title}<ErrorView error={q.error} onRetry={() => q.refetch()} /></>;

  const items = q.data ?? [];
  return (
    <Screen edges={["bottom"]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {title}
      {items.length === 0 ? (
        <EmptyState title="Queue is clear">Nothing waiting for review. Receipts show up here as members upload them, oldest first.</EmptyState>
      ) : (
        <>
          <Text muted>
            {items.length} receipt{items.length === 1 ? "" : "s"} waiting · oldest first
          </Text>
          {items.map((it, i) => (
            <QueueRow key={it.id} item={it} position={i + 1} />
          ))}
        </>
      )}
    </Screen>
  );
}

function QueueRow({ item, position }: { item: ReviewItemDTO; position: number }) {
  const { c } = useTheme();
  const dup = item.hints.refCheck && !item.hints.refCheck.ok;
  return (
    <Pressable
      onPress={() => router.push(`/review/${item.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${item.userName || item.userEmail}, ${peso(item.totalCents)}, ${item.event.title}`}
    >
      <Card>
        <Row style={{ alignItems: "flex-start" }} gap={space.md}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" muted numberOfLines={1}>
              {position}. {item.event.title}
            </Text>
            <Text variant="heading" numberOfLines={1}>{item.userName || item.userEmail}</Text>
            <Text variant="caption" muted>
              {item.submittedAt ? `Receipt sent ${relative(item.submittedAt)}` : "No receipt time"}
              {item.paymentRef ? ` · ref ${item.paymentRef}` : ""}
            </Text>
            {dup && (
              <Row gap={6}>
                <AlertTriangle size={14} color={c.destructive} />
                <Text variant="caption" color={c.destructive}>Reference {item.hints.refCheck!.text}</Text>
              </Row>
            )}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text variant="heading">{peso(item.totalCents)}</Text>
            <ChevronRight size={18} color={c.mutedForeground} />
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}
