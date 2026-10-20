import type { TicketRenderInput } from "./render/types";

/** Sample ticket used by the ticket lab and style previews. */
export function sampleTicket(theme: "light" | "dark", appUrl: string): Omit<TicketRenderInput, "barcodeSvg"> {
  return {
    url: `${appUrl}/t/v1.sampleTicket00000.sampleEvent0.MEUCIQDl5K0pJvS0y7kG9c4xkPZ0q0ZqG0x7Zs0b1Yd0kq8xwIgQe3Ff6u5QYzq2bQ1l8Zc9K1t3H0Oe7Yw6o2Xy5V9z2A`,
    shortCode: "BBC-7K3M-PX2Q",
    holderName: "Zen Lucas",
    tierName: "Early Bird",
    event: {
      title: "Base Camp Sessions Vol. 3",
      startsAt: new Date("2026-11-01T19:00:00+08:00"),
      venueName: "Canto, Ketchup Food Community",
    },
    theme,
  };
}
