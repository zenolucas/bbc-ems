/** Shared return shape for imperative server actions. `r.error` is always safe to read. */
export type ActionResult<T extends object = object> = ({ ok: true; error?: undefined } & T) | { ok?: false; error: string };
