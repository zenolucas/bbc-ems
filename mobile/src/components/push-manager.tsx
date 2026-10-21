import * as Notifications from "expo-notifications";
import { router, useRootNavigationState, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { configureForegroundHandling, enablePush, refreshAfterTokenChange, routeForNotification, unregisterPush } from "@/lib/push";
import { onBeforeSignOut, useSession } from "@/lib/session";

configureForegroundHandling();

/**
 * Keeps this phone registered for pushes and opens the right screen when one
 * is tapped. Renders nothing; mounted once next to the root stack.
 */
export function PushManager() {
  const { status } = useSession();
  const previous = useRef(status);
  const navReady = !!useRootNavigationState()?.key;
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  // Ask right after someone signs in (they just chose to use the app); on later
  // launches only re-register if they already said yes. Never prompt signed out.
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (status !== "signedIn") return;
    enablePush({ ask: was === "signedOut" });
  }, [status]);

  useEffect(() => onBeforeSignOut(unregisterPush), []);

  useEffect(() => {
    const sub = Notifications.addPushTokenListener(() => void refreshAfterTokenChange());
    return () => sub.remove();
  }, []);

  // Taps, including the one that cold-started the app. Wait for the navigator to mount.
  useEffect(() => {
    if (!response || !navReady || status !== "signedIn") return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    router.push(routeForNotification(response.notification.request.content.data) as Href);
    Notifications.clearLastNotificationResponse();
  }, [response, navReady, status]);

  return null;
}
