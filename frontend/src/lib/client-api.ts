// Browser-side API access through the /api rewrite. Throws ApiError with the backend's code and message.
// This work made by Anfinogentov Nikita
import { ApiError, toApiError } from "./errors";

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; json?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: options.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
    });
  } catch {
    throw new ApiError(0, "network_error", "No connection to the server. Check your internet and try again.");
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}
