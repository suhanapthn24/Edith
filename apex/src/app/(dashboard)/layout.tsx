import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#1E1118]">
      <Navbar />
      <main className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
