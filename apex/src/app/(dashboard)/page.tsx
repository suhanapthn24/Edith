import { redirect } from "next/navigation";

// Route group root redirects to /dashboard to avoid conflict with app/page.tsx
export default function DashboardGroupRoot() {
  redirect("/dashboard");
}
