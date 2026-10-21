import { Tabs } from "expo-router";
import { CalendarDays, ScanLine, Ticket, UserRound } from "lucide-react-native";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/theme";

export default function TabsLayout() {
  const { c } = useTheme();
  const { isStaff } = useSession();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Events", tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="tickets" options={{ title: "Tickets", tabBarIcon: ({ color, size }) => <Ticket color={color} size={size} /> }} />
      {/* Door crew and admins only; hidden, not removed, so deep links still resolve */}
      <Tabs.Screen name="door" options={{ title: "Door", href: isStaff ? undefined : null, tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
