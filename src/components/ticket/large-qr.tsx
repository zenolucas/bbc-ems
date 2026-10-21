import { qrMatrix } from "@/lib/tickets/qr";

/**
 * A plain, big QR for landscape ticket styles (Trail Pass) on phones, where the
 * ticket's own QR stub ends up about 80px wide. Black on white with a quiet zone:
 * the most scannable form, and the same payload as the ticket.
 */
export function LargeQr({ data, code, className }: { data: string; code: string; className?: string }) {
  const { size, modules } = qrMatrix(data, "M");
  const quiet = 4;
  const n = size + quiet * 2;
  let d = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  return (
    <figure className={className}>
      <div className="rounded-2xl bg-white p-2">
        <svg viewBox={`0 0 ${n} ${n}`} className="block aspect-square w-full" shapeRendering="crispEdges" role="img" aria-label={`QR code for ticket ${code}`}>
          <rect width={n} height={n} fill="#fff" />
          <path d={d} fill="#000" />
        </svg>
      </div>
      <figcaption className="mt-2 text-center font-mono text-sm font-semibold tracking-[0.12em]">{code}</figcaption>
    </figure>
  );
}
