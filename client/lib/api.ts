/**
 * Centralized API configuration and helper utilities for Baitlock.
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

/**
 * Returns authorization headers with Bearer token if present in localStorage.
 */
export function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}
