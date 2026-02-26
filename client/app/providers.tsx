"use client";

import * as React from "react";
import { AuthProvider } from "../context/AuthContext.jsx";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
