import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx won't fix itself; retry only network blips and 5xx
      retry: (count, e) => count < 2 && !(e instanceof ApiError && e.status >= 400 && e.status < 500),
    },
    mutations: { retry: false },
  },
});

// React Query's "window focus" and "online" are browser ideas; wire them to the app state and NetInfo.
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));
AppState.addEventListener("change", (s) => {
  if (Platform.OS !== "web") focusManager.setFocused(s === "active");
});
