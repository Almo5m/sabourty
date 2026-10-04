"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
