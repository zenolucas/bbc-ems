import { Tabs, useSegments } from "expo-router";
import { CalendarDays, ScanLine, Ticket, UserRound } from "lucide-react-native";
import { Text } from "react-native";
import { useSession } from "@/lib/session";
import { fonts, nightTheme, useTheme } from "@/theme";

export default function TabsLayout() {
  const theme = useTheme();
  const { isStaff } = useSession();
  // The Door tab is always Starlit Night, so the whole bar follows it there. Tab colours are read
  // per tab, which is why this switches the shared screenOptions rather than the door screen's own.
  const segments = useSegments() as string[];
  const { c } = segments.includes("door") ? nightTheme : theme;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        // Labels grow with the phone's text size, up to 1.3x: four tabs at 11pt don't fit wider than that
        tabBarLabel: ({ color, children }) => (
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color, fontFamily: fonts.bodySemi, fontSize: 11 }}>
            {children}
          </Text>
        ),
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
