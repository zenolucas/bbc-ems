import type { TicketStyle } from "@/db/schema";
import { campfireStamp } from "./styles/campfire-stamp";
import { nightSky } from "./styles/night-sky";
import { ridgeLine } from "./styles/ridge-line";
import { summit } from "./styles/summit";
import { trailPass } from "./styles/trail-pass";
import type { TicketRenderInput, TicketRenderer } from "./types";

export const renderers: Record<TicketStyle, TicketRenderer> = {
  summit,
  "night-sky": nightSky,
  "trail-pass": trailPass,
  "ridge-line": ridgeLine,
  "campfire-stamp": campfireStamp,
};

export function renderTicketSvg(style: TicketStyle, input: TicketRenderInput) {
  return renderers[style](input);
}

export { STYLE_META } from "./types";
export type { TicketRenderInput, Theme } from "./types";
