export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UPSTREAM_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

/** Throw from services or handlers; `apiHandler` turns it into a JSON error response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message = "Conflict") {
    return new ApiError(409, "CONFLICT", message);
  }
  static payloadTooLarge(limitBytes: number) {
    return new ApiError(413, "PAYLOAD_TOO_LARGE", "Request is too large", { limitBytes });
  }
  static upstream(message = "A service we depend on isn't responding. Please try again.") {
    return new ApiError(502, "UPSTREAM_ERROR", message);
  }
  static rateLimited(retryAfterSeconds: number) {
    return new ApiError(429, "RATE_LIMITED", "Too many attempts. Please try again later.", { retryAfterSeconds });
  }
}

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; details?: unknown };
};
