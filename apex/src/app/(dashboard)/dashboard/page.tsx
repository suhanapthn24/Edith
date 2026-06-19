import { BriefingCard } from "@/components/dashboard/briefing-card";
import { FocusList } from "@/components/dashboard/focus-list";
import { StreaksRow } from "@/components/dashboard/streaks-row";
import { CalendarPreview } from "@/components/dashboard/calendar-preview";
import { NeetcodeProgress } from "@/components/dashboard/neetcode-progress";
import { LanguageProgress } from "@/components/dashboard/language-progress";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const today = formatDate(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="fade-in">
        <p
          className="text-xs font-medium tracking-[0.1em] uppercase text-[#AABAAE]/70 mb-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          {today}
        </p>
        <h1
          className="text-4xl font-light text-[#E3D6BF]"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Good morning, <span className="italic text-[#933B5B]">Suhana</span>
        </h1>
        <p
          className="text-sm text-[#E3D6BF]/50 mt-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Here&apos;s what your AI chief of staff has prepared for you today.
        </p>
      </div>

      {/* AI Briefing — full width */}
      <BriefingCard />

      {/* Focus + Streaks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FocusList />
        </div>
        <div>
          <StreaksRow />
        </div>
      </div>

      {/* Calendar + NeetCode + Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CalendarPreview />
        <NeetcodeProgress />
        <LanguageProgress />
      </div>

      {/* Quick Stats */}
      <QuickStats />
    </div>
  );
}
