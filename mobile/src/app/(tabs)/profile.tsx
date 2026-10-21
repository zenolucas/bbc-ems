import { EmptyState, Screen } from "@/components/ui";

// Placeholder, replaced in its own phase
export default function Placeholder() {
  return (
    <Screen scroll={false}>
      <EmptyState title="profile">Coming next.</EmptyState>
    </Screen>
  );
}
