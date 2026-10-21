import type { EventRefDTO } from "@bbc/shared/api-types";
import * as CalendarNext from "expo-calendar";
import { createEventInCalendarAsync } from "expo-calendar/legacy";
import { CalendarPlus } from "lucide-react-native";
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { Button } from "@/components/ui";
import { useTheme } from "@/theme";

/**
 * Opens the phone's own "new event" form, filled in. The person saves it to whichever
 * calendar they like, so the app never reads or writes their calendars itself.
 *
 * Android: the legacy API, because the new one needs a calendar object, which on Android
 * means listing calendars (READ_CALENDAR). The legacy form is a plain ACTION_INSERT intent
 * with no permission. iOS: the new API on the default calendar, with write-only access.
 */
async function openEventForm(e: EventRefDTO, link: string) {
  const startDate = new Date(e.startsAt);
  const endDate = e.endsAt ? new Date(e.endsAt) : new Date(startDate.getTime() + 6 * 3600e3);
  const details = {
    title: e.title,
    startDate,
    endDate,
    location: e.venueName,
    notes: `Your tickets: ${link}\nShow the QR at the door; it's saved in the Baguio Base Camp app.`,
  };
  if (Platform.OS === "android") {
    await createEventInCalendarAsync(details);
    return;
  }
  const { granted } = await CalendarNext.requestCalendarPermissions(true);
  if (!granted) {
    Alert.alert("Calendar access is off", "Allow Baguio Base Camp to add events in Settings, then try again.");
    return;
  }
  await CalendarNext.getDefaultCalendarSync().addEventWithForm({ ...details, url: link });
}

export function AddToCalendarButton({ event, link }: { event: EventRefDTO; link: string }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title="Add to calendar"
      variant="ghost"
      loading={busy}
      icon={<CalendarPlus size={18} color={c.foreground} />}
      onPress={async () => {
        setBusy(true);
        try {
          await openEventForm(event, link);
        } catch {
          Alert.alert("Couldn't open your calendar", "Add it by hand for now: the date and venue are on this screen.");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
