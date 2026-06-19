"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Languages,
  Code2,
  BookOpen,
  Brain,
  Briefcase,
  GraduationCap,
  Bell,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar",  href: "/calendar",  icon: CalendarDays    },
  { label: "Languages", href: "/language",  icon: Languages       },
  { label: "DSA",       href: "/dsa",       icon: Code2           },
  { label: "Research",  href: "/research",  icon: BookOpen        },
  { label: "Knowledge", href: "/knowledge", icon: Brain           },
  { label: "Career",    href: "/career",    icon: Briefcase       },
  { label: "Skills",    href: "/skills",    icon: GraduationCap   },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 gap-8"
      style={{
        background: "rgba(30, 17, 24, 0.92)",
        borderBottom: "1px solid rgba(170, 186, 174, 0.2)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 select-none">
        <Image
          src="/logo.png"
          alt="APEX Logo"
          width={32}
          height={32}
          className="rounded-lg object-contain"
          priority
        />
        <span
          className="text-2xl font-light tracking-[0.2em] text-[#E3D6BF]"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          APEX
        </span>
      </Link>

      {/* Nav Items */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
                isActive
                  ? "bg-[#AABAAE]/15 text-[#E3D6BF]"
                  : "text-[#E3D6BF]/60 hover:text-[#E3D6BF]/90 hover:bg-white/5"
              )}
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              <Icon
                size={15}
                className={cn(
                  "shrink-0",
                  isActive ? "text-[#AABAAE]" : "text-current"
                )}
              />
              {label}
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#933B5B] shrink-0" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          className="relative p-2 rounded-lg text-[#E3D6BF]/60 hover:text-[#E3D6BF] hover:bg-white/5 transition-all"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#933B5B]" />
        </button>

        <button className="flex items-center gap-2 pl-3 border-l border-[#AABAAE]/20">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#AABAAE] to-[#150D11] flex items-center justify-center text-sm font-semibold text-[#E3D6BF]">
            S
          </div>
          <ChevronDown size={14} className="text-[#E3D6BF]/40" />
        </button>
      </div>
    </nav>
  );
}
