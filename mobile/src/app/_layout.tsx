import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DemoBanner } from "@/components/demo/demo-banner";
import { PushManager } from "@/components/push-manager";
import { queryClient } from "@/lib/query";
import "@/scanner/background-sync"; // defines the door sync background task at module scope
import { SessionProvider, useSession } from "@/lib/session";
import { fontFiles, fonts, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

// A screen opened from a notification or link gets the tabs underneath it, so Back has somewhere to go
export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootStack />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { status } = useSession();
  const { dark, c } = useTheme();
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [status]);
  if (status === "loading") return null;
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <DemoBanner>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.foreground,
            headerTitleStyle: { fontFamily: fonts.displaySemi },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: c.background },
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Sign in" }} />
          {/* Draws its own header (close, reload, progress) */}
          <Stack.Screen name="organiser" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        </Stack>
      </DemoBanner>
      <PushManager />
    </>
  );
}
