// Server-side API access: calls the backend directly and forwards the visitor's cookies.
// This work made by Anfinogentov Nikita
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { ApiError, toApiError } from "./errors";
import type { Me } from "./types";

const apiUrl = process.env.API_URL ?? "http://localhost:8040";

export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(apiUrl + path, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

// For blocks that may quietly disappear: a guest, a missing record, a store outage or an unreachable API
// hides the block instead of breaking the whole page.
export async function apiTry<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status >= 500 || [401, 403, 404].includes(error.status))) return null;
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export const getMe = cache(() => apiTry<Me>("/api/auth/me"));
