import type { ConfigDTO } from "@bbc/shared/demo";
import { useQuery } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { api } from "./api";

const KEY = "bbc:config";
const OFF: ConfigDTO = { demoSite: false, demo: null };

export const configKey = ["config"] as const;

function cached(): ConfigDTO | undefined {
  try {
    const raw = Storage.getItemSync(KEY);
    return raw ? (JSON.parse(raw) as ConfigDTO) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What the server offers this app: today, whether it's the demo site and its demo
 * switch is on (persona sign-in, sample receipts, door samples). Starts from the last
 * answer saved on the phone so the demo tools don't vanish with the signal.
 */
export function useServerConfig() {
  const q = useQuery({
    queryKey: configKey,
    queryFn: async () => {
      const c = await api<ConfigDTO>("/api/v1/config");
      Storage.setItem(KEY, JSON.stringify(c)).catch(() => {});
      return c;
    },
    initialData: cached,
    staleTime: 30_000,
  });
  return q.data ?? OFF;
}

/** Demo shortcuts are on (the demo site with its switch on). */
export function useDemo() {
  return useServerConfig().demo;
}
