import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 120% 60% at 50% 0%, #2C1A0E 0%, #0D0906 55%, #080604 100%)",
      }}
    >
      <Navbar />
      <main className="flex-1 overflow-hidden pt-14">{children}</main>
    </div>
  );
}
