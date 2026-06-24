import { BookOpen, Code2, MessageSquare, Award } from "lucide-react";

type Stat = {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
};

const stats: Stat[] = [
  { label: "Papers Read",    value: 23,       sub: "+2 this week",       icon: BookOpen,     color: "#933B5B", trend: "up" },
  { label: "LC Problems",    value: "23/150",  sub: "NeetCode 150",       icon: Code2,        color: "#AABAAE", trend: "up" },
  { label: "Vocab Items",    value: 847,       sub: "across 3 languages", icon: MessageSquare, color: "#150D11" },
  { label: "Certifications", value: 2,         sub: "3 in progress",      icon: Award,        color: "#933B5B" },
];

export function QuickStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-2xl p-4 fade-in"
            style={{
              background: "rgba(21, 13, 17, 0.6)",
              border: "1px solid rgba(170, 186, 174, 0.18)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="p-2 rounded-xl"
                style={{ background: `${stat.color}18` }}
              >
                <Icon size={16} style={{ color: stat.color }} />
              </div>
              {stat.trend && (
                <span
                  className="text-[10px] font-medium text-[#AABAAE] bg-[#AABAAE]/10 px-1.5 py-0.5 rounded-full"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  ↑ up
                </span>
              )}
            </div>
            <p
              className="text-2xl font-light text-[#E3D6BF] mb-0.5"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              {stat.value}
            </p>
            <p
              className="text-xs font-medium text-[#E3D6BF]/70"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {stat.label}
            </p>
            <p
              className="text-[10px] text-[#E3D6BF]/35 mt-0.5"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {stat.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}
