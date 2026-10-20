import { importPrivateKey, importPublicKey, signTicket, encodeToken, parseToken, verifyTicketSignature, ticketUrl } from "../src/lib/tickets/token";
(async () => {
  const priv = await importPrivateKey(process.env.TICKET_SIGNING_PRIVATE_KEY!);
  const pub = await importPublicKey(process.env.TICKET_SIGNING_PUBLIC_KEY!);
  const sig = await signTicket(priv, "abcDEF123456789x", "evt_0123456789ab");
  const token = encodeToken({ ticketId: "abcDEF123456789x", eventId: "evt_0123456789ab", signature: sig });
  const url = ticketUrl("http://localhost:3000", token);
  console.log(url, url.length);
  const parts = parseToken(url)!;
  console.log("verify ok:", await verifyTicketSignature(pub, parts));
  parts.ticketId = "tampered00000000";
  console.log("verify tampered:", await verifyTicketSignature(pub, parts));
})();
