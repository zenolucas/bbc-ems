/** Renders a trusted, server-generated ticket SVG inline so page fonts apply. */
export function TicketSvg({ svg, className }: { svg: string; className?: string }) {
  return <div className={className ?? "mx-auto w-full max-w-[520px] [&>svg]:h-auto [&>svg]:w-full"} dangerouslySetInnerHTML={{ __html: svg }} />;
}
