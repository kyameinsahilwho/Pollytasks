"use client";

import { cn } from "@/lib/utils";
import { Habit } from "@/lib/types";
import { HabitItem } from "./habit-item";
import { AddHabitDialog } from "./add-habit-dialog";
import { Button } from "./ui/button";
import { Plus, Flame, Target, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { RitualStats } from "./ritual-stats";
import { startOfDay, parseISO, differenceInCalendarDays, addWeeks, addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HabitTrackerProps {
  habits: Habit[];
  onAddHabit: (habitData: Omit<Habit, 'id' | 'currentStreak' | 'bestStreak' | 'createdAt' | 'completions'>) => void;
  onUpdateHabit: (id: string, habitData: Partial<Omit<Habit, 'id' | 'currentStreak' | 'bestStreak' | 'createdAt' | 'completions'>>) => void;
  onToggleHabit: (habitId: string, date: string) => void;
  onDeleteHabit: (id: string) => void;
}

export function HabitTracker({ habits, onAddHabit, onUpdateHabit, onToggleHabit, onDeleteHabit }: HabitTrackerProps) {
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dateOffset, setDateOffset] = useState(0);
  const [direction, setDirection] = useState(0);

  // Reset scroll position when switching between list and stats
  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  }, [selectedHabitId]);

  useEffect(() => {
    setDirection(0);
    setDateOffset(0);
  }, [activeTab]);

  const selectedHabit = habits.find(h => h.id === selectedHabitId);

  if (selectedHabit) {
    return <RitualStats habit={selectedHabit} onBack={() => setSelectedHabitId(null)} />;
  }

  const today = new Date();
  const dayOfWeek = today.getDay();

  const activeHabits = habits.filter(h => !h.archived);

  // Filter based on activeTab
  const dailyHabits = activeTab === 'daily' ? activeHabits.filter(h => h.frequency === 'daily') : [];
  const weeklyHabits = activeTab === 'weekly' ? activeHabits.filter(h => h.frequency === 'weekly') : [];
  const monthlyHabits = activeTab === 'monthly' ? activeHabits.filter(h => h.frequency === 'monthly') : [];

  const intervalHabits = activeTab === 'daily' ? activeHabits.filter(h => {
    if (!['every_2_days', 'every_3_days', 'every_4_days'].includes(h.frequency)) return false;
    return true; // Show all in the week view
  }) : [];

  const specificDayHabits = activeTab === 'daily' ? activeHabits.filter(h => {
    return h.frequency === 'specific_days';
  }) : [];

  const isAnyHabitVisible = dailyHabits.length > 0 ||
    specificDayHabits.length > 0 ||
    intervalHabits.length > 0 ||
    weeklyHabits.length > 0 ||
    monthlyHabits.length > 0;

  let currentDate = today;
  let dateLabel = "";

  if (activeTab === 'daily') {
    currentDate = addWeeks(today, dateOffset);
    if (dateOffset === 0) dateLabel = "This Week";
    else if (dateOffset === -1) dateLabel = "Last Week";
    else if (dateOffset === 1) dateLabel = "Next Week";
    else dateLabel = `${Math.abs(dateOffset)} Weeks ${dateOffset < 0 ? 'Ago' : 'Ahead'}`;
  } else if (activeTab === 'weekly') {
    currentDate = addMonths(today, dateOffset);
    if (dateOffset === 0) dateLabel = "This Month";
    else if (dateOffset === -1) dateLabel = "Last Month";
    else dateLabel = format(currentDate, 'MMMM yyyy');
  } else if (activeTab === 'monthly') {
    currentDate = addMonths(today, dateOffset * 6);
    if (dateOffset === 0) dateLabel = "Last 6 Months";
    else {
      const start = subMonths(currentDate, 5);
      dateLabel = `${format(start, 'MMM yyyy')} - ${format(currentDate, 'MMM yyyy')}`;
    }
  }

  const renderHabitList = (title: string, habitsList: Habit[]) => {
    if (habitsList.length === 0) return null;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <AnimatePresence mode="popLayout">
            {habitsList.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                currentDate={currentDate}
                onToggle={onToggleHabit}
                onUpdate={onUpdateHabit}
                onDelete={onDeleteHabit}
                onViewStats={setSelectedHabitId}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-32">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 pt-3 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">

          {/* Left: Title + Tab Switcher */}
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl border border-[#E2E8F0] shadow-sm rounded-full px-4 py-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#1E293B] shrink-0 pl-1">
              My Rituals
            </h2>
            <div className="h-5 w-px bg-[#E2E8F0]" />
            {/* Tab Pills */}
            <div className="relative flex items-center bg-[#F1F4F9] p-1 rounded-full border border-[#E2E8F0] gap-0.5">
              {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setDirection(0); setActiveTab(tab); }}
                  className={cn(
                    "relative px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-200 cursor-pointer z-10",
                    activeTab === tab
                      ? "text-[#1E293B]"
                      : "text-[#94A3B8] hover:text-[#64748B]"
                  )}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-white rounded-full shadow-sm border border-[#E2E8F0]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Date Navigator */}
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xl border border-[#E2E8F0] shadow-sm rounded-full px-2.5 py-2 self-end sm:self-auto">
            <button
              onClick={() => { setDirection(-1); setDateOffset(prev => prev - 1); }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F1F4F9] transition-all active:scale-90"
            >
              <ChevronLeft className="w-4.5 h-4.5 text-[#64748B]" />
            </button>

            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={`${activeTab}-${dateOffset}`}
                initial={{ opacity: 0, y: direction > 0 ? -8 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction > 0 ? 8 : -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-xs font-black uppercase tracking-widest text-[#1E293B] min-w-[110px] text-center"
              >
                {dateLabel}
              </motion.span>
            </AnimatePresence>

            <button
              onClick={() => { setDirection(1); setDateOffset(prev => prev + 1); }}
              disabled={dateOffset >= 0}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90",
                dateOffset >= 0
                  ? "opacity-25 cursor-not-allowed"
                  : "hover:bg-[#F1F4F9]"
              )}
            >
              <ChevronRight className="w-4.5 h-4.5 text-[#64748B]" />
            </button>
          </div>

        </div>
      </div>

      <div className="overflow-hidden relative w-full pt-2">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={`${activeTab}-${dateOffset}`}
            custom={direction}
            variants={{
              initial: (d: number) => ({ opacity: 0, x: d === 0 ? 0 : d > 0 ? 100 : -100 }),
              animate: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d === 0 ? 0 : d > 0 ? -100 : 100 })
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="flex flex-col gap-12"
          >
            {activeHabits.length > 0 ? (
              isAnyHabitVisible ? (
                <>
                  {renderHabitList("Daily", dailyHabits)}
                  {renderHabitList("Custom Schedule", specificDayHabits)}
                  {renderHabitList("Interval", intervalHabits)}
                  {renderHabitList("Weekly", weeklyHabits)}
                  {renderHabitList("Monthly", monthlyHabits)}
                </>
              ) : (
                <div className="py-20 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-6 bg-[#F1F4F9]/30 rounded-[3rem] border-2 border-b-8 border-dashed border-[#E2E8F0]">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-2 border-b-4 border-[#E2E8F0] shadow-inner">
                    <Flame className="w-10 h-10 text-[#CBD5E1]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#1E293B] uppercase tracking-tight">Rest Day!</h3>
                    <p className="text-[#64748B]/60 font-medium">No rituals scheduled for today. Enjoy your break!</p>
                  </div>
                </div>
              )
            ) : (
              <div className="py-28 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-6 bg-[#F1F4F9]/30 rounded-[3rem] border-2 border-b-8 border-dashed border-[#E2E8F0]">
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-2 border-b-4 border-[#E2E8F0] shadow-inner">
                  <Target className="w-12 h-12 text-[#CBD5E1]" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#1E293B] uppercase tracking-tight">No Rituals Yet</h3>
                  <p className="text-[#64748B]/60 font-medium">Start your journey by adding your first daily ritual.</p>
                </div>
                <AddHabitDialog onAddHabit={onAddHabit}>
                  <Button className="mt-4 border-2 border-b-[6px] border-[#4f46e5] bg-[#6366f1] text-white hover:bg-[#818cf8] hover:border-[#6366f1] font-black uppercase tracking-widest active:translate-y-[2px] active:border-b-[4px] transition-all rounded-2xl h-auto py-5 px-10 text-lg relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-px bg-white/40 z-10 pointer-events-none" />
                    Create Ritual
                  </Button>
                </AddHabitDialog>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
