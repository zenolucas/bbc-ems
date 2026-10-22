import { type ConfigDTO, DEMO_PERSONAS, PERSONA_LABELS } from "@bbc/shared/demo";
import { apiUser } from "@/lib/api/auth";
import { handle } from "@/lib/api/respond";
import { getDemoState } from "@/lib/demo/flag";
import { personaForUser } from "@/lib/demo/personas";

/** What this server offers the clients. Today: whether demo mode is on and who you can be. */
export const GET = handle(async (req: Request): Promise<ConfigDTO> => {
  const state = await getDemoState();
  if (!state.enabled) return { demoSite: state.site, demo: null };
  return {
    demoSite: true,
    demo: {
      enabled: true,
      autoApprove: state.autoApprove,
      personas: DEMO_PERSONAS.map((key) => ({ key, ...PERSONA_LABELS[key] })),
      current: personaForUser(await apiUser(req)),
    },
  };
});
