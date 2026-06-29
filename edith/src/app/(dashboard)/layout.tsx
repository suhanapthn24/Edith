import dynamic from "next/dynamic";
import { Navbar } from "@/components/layout/navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthStatusBar } from "@/components/auth/AuthStatusBar";
import { EnrollmentGate } from "@/components/auth/EnrollmentGate";

// BiometricWatcher uses browser-only APIs — disable SSR
const BiometricWatcher = dynamic(
  () => import("@/components/auth/BiometricWatcher").then((m) => ({ default: m.BiometricWatcher })),
  { ssr: false }
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 0%, #2C1A0E 0%, #0D0906 55%, #080604 100%)",
        }}
      >
        <Navbar />
        <main className="flex-1 overflow-hidden pt-14 relative">
          <EnrollmentGate />
          <BiometricWatcher />
          <AuthStatusBar />
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
