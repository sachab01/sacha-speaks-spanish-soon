export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/** No Gemini model in the requested chain has quota left — "daily" until the Pacific-midnight reset, "minute" for a short wait. */
export class QuotaExhaustedError extends Error {
  constructor(
    readonly kind: "daily" | "minute",
    message: string,
  ) {
    super(message);
  }
}

/** The HTTP status an API client error carries (Gemini SDK, Mistral client), or null if it has none. */
export function httpStatusOf(error: unknown): number | null {
  return typeof error === "object" && error !== null && "status" in error
    ? ((error as { status: unknown }).status as number)
    : null;
}
