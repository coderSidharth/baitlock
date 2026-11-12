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


export type RiskTier = "safe" | "moderate" | "high" | "critical";
export interface SecurityEvent {
  id: string;
  type: "phishing" | "fraud";
  target: string;
  score: number;
  verdict: string;
  tier: RiskTier;
  reasons: string[];
  created_at: string;
}
export interface ScoreResult {
  breakdown: { rule_score: number; ml_score: number; llm_score: number | null };
  final_score: number;
  verdict: string;
  tier: RiskTier;
  reasons: string[];
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function apiError(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(item => apiError(item, fallback)).join(", ");
  if (detail && typeof detail === "object") {
    if ("msg" in detail) return String(detail.msg);
    if ("message" in detail) return String(detail.message);
  }
  return fallback;
}
