"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EnrollmentModal } from "./EnrollmentModal";

export function EnrollmentGate() {
  const { state } = useAuth();
  if (state !== "unenrolled") return null;
  return <EnrollmentModal />;
}
