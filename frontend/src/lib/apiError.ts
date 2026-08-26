/**
 * Normalizes RTK Query errors + the backend error envelope
 * `{ status, message, timestamp, fieldErrors? }` into one shape for UI code.
 */
export interface ApiErrorInfo {
  status?: number | string;
  message: string;
  fieldErrors: Record<string, string> | null;
}

interface FetchBaseQueryErrorLike {
  status: number | "FETCH_ERROR" | "PARSING_ERROR" | "TIMEOUT_ERROR" | string;
  data?: unknown;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getApiError(error: unknown): ApiErrorInfo {
  const err = error as FetchBaseQueryErrorLike | undefined;
  if (!err) {
    return { message: "Something went wrong", fieldErrors: null };
  }

  const data = err.data;
  // Backend envelope
  if (isRecord(data)) {
    const fieldErrors =
      isRecord(data.fieldErrors) && Object.keys(data.fieldErrors).length > 0
        ? (Object.fromEntries(
            Object.entries(data.fieldErrors).map(([k, v]) => [k, String(v)]),
          ) as Record<string, string>)
        : null;
    if ("message" in data || fieldErrors) {
      return {
        status: typeof err.status === "number" ? err.status : undefined,
        message:
          typeof data.message === "string"
            ? data.message
            : "Validation failed",
        fieldErrors,
      };
    }
  }

  if (err.status === "FETCH_ERROR") {
    return {
      status: err.status,
      message: "Cannot reach the server. Is the backend running on :8080?",
      fieldErrors: null,
    };
  }
  if (err.status === "TIMEOUT_ERROR") {
    return {
      status: err.status,
      message: "The server took too long to respond.",
      fieldErrors: null,
    };
  }
  if (typeof err.error === "string") {
    return { status: err.status, message: err.error, fieldErrors: null };
  }

  return {
    status: typeof err.status === "number" ? err.status : undefined,
    message: "Something went wrong",
    fieldErrors: null,
  };
}
