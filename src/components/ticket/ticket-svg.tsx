/** Renders a trusted, server-generated ticket SVG inline so page fonts apply. */
export function TicketSvg({ svg, className, label }: { svg: string; className?: string; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label ?? "Ticket with QR code"}
      className={className ?? "mx-auto w-full max-w-[520px] [&>svg]:h-auto [&>svg]:w-full"}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
