import { FlaskConical } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/panel";
import { Notice } from "@/components/ui/notice";
import { getDemoMarker } from "@/lib/demo/flag";
import { demoSiteOr404 } from "@/lib/demo/guard";
import { listOutbox } from "@/lib/demo/outbox";
import { demoKeyFingerprint } from "@/lib/demo/seed";
import { relative } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { DemoControls, OutboxClear } from "./demo-controls";
import { OutboxList } from "./outbox-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo tools" };

export default async function DemoPage() {
  await requireAdmin();
  const state = await demoSiteOr404();
  const [marker, outbox] = await Promise.all([getDemoMarker(), listOutbox({ limit: 60 })]);
  const fingerprint = (() => {
    try {
      return demoKeyFingerprint();
    } catch {
      return null;
    }
  })();
  const keyMismatch = marker && fingerprint && marker.keyFingerprint !== fingerprint;
  return (
    <div className="max-w-3xl space-y-[18px]">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><FlaskConical className="size-6 text-muted-foreground" aria-hidden /> Demo tools</span>}
        sub={`This is the demo site: its email and pushes land in the outbox below, never in an inbox.${marker ? ` Demo database since ${relative(new Date(marker.createdAt))}.` : ""}`}
      />

      {keyMismatch && (
        <Notice tone="warn" title="Tickets were signed with a different key">
          The demo data was seeded with another deployment&apos;s signing key, so the scanner will reject every QR. Reset the demo data from here to re-sign them with this site&apos;s key.
        </Notice>
      )}

      <DemoControls enabled={state.enabled} autoApprove={state.autoApprove} />

      <Panel id="outbox" title="Outbox" meta={<OutboxClear count={outbox.length} />}>
        <OutboxList
          rows={outbox.map((r) => ({
            id: r.id,
            kind: r.kind,
            to: r.toAddress,
            subject: r.subject,
            html: r.html,
            text: r.text,
            url: r.url,
            attachments: (r.meta?.attachments as string[] | undefined) ?? [],
            at: relative(r.createdAt),
          }))}
        />
      </Panel>
    </div>
  );
}
