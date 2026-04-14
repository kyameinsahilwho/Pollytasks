"use client";

import { useState, useMemo } from "react";
import { Habit, Task } from "@/lib/types";
import { HabitItem } from "./habit-item";
import TaskList from "./task-list";
import { isHabitDueToday } from "@/lib/utils";
import {
  isBefore, isSameDay, startOfDay, parseISO, format, addWeeks, addMonths,
  isSameWeek, isSameMonth, startOfWeek, endOfWeek, subMonths, startOfMonth, endOfMonth,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { RitualStats } from "./ritual-stats";
import { AddHabitDialog } from "./add-habit-dialog";
import { ChevronLeft, ChevronRight, Target, Flame, LayoutGrid, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskViewProps {
  habits: Habit[];
  tasks: Task[];
  onToggleHabit: (id: string, date: string) => void;
  onUpdateHabit: (id: string, data: any) => void;
  onDeleteHabit: (id: string) => void;
  onAddHabit: (habitData: any) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onAddSubtask: (id: string, text: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => any;
  setCelebrating: (val: boolean) => void;
}

type Tab = 'daily' | 'weekly' | 'monthly';

export function TaskView({
  habits, tasks,
  onToggleHabit, onUpdateHabit, onDeleteHabit, onAddHabit,
  onToggleTask, onDeleteTask, onEditTask, onAddSubtask, onToggleSubtask, setCelebrating,
}: TaskViewProps) {
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [dateOffset, setDateOffset] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showFilter, setShowFilter] = useState<'both' | 'tasks' | 'rituals'>('both');

  const selectedHabit = habits.find(h => h.id === selectedHabitId);

  const today = new Date();
  const activeHabits = habits.filter(h => !h.archived);

  // ── Date navigation ───────────────────────────────────────────────────────
  let currentDate = today;
  let dateLabel = "";

  if (activeTab === 'daily') {
    currentDate = addWeeks(today, dateOffset);
    dateLabel = dateOffset === 0 ? "This Week"
      : dateOffset === -1 ? "Last Week"
      : dateOffset === 1 ? "Next Week"
      : `${Math.abs(dateOffset)} Weeks ${dateOffset < 0 ? 'Ago' : 'Ahead'}`;
  } else if (activeTab === 'weekly') {
    currentDate = addMonths(today, dateOffset);
    dateLabel = dateOffset === 0 ? "This Month"
      : dateOffset === -1 ? "Last Month"
      : format(currentDate, 'MMMM yyyy');
  } else {
    currentDate = addMonths(today, dateOffset * 6);
    dateLabel = dateOffset === 0 ? "Last 6 Months"
      : (() => { const s = subMonths(currentDate, 5); return `${format(s, 'MMM yyyy')} – ${format(currentDate, 'MMM yyyy')}`; })();
  }

  // ── Tasks filtered by tab ─────────────────────────────────────────────────
  const activeTasks = tasks.filter(t => !t.isCompleted);

  const { tabTasks, tabLabel } = useMemo(() => {
    const todayStart = startOfDay(today);

    if (activeTab === 'daily') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd   = endOfWeek(currentDate,   { weekStartsOn: 0 });

      if (dateOffset === 0) {
        // Today: incomplete tasks due today or overdue (past due)
        const due = activeTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = startOfDay(parseISO(t.dueDate));
          return isSameDay(d, todayStart) || isBefore(d, todayStart);
        });
        // Also show upcoming this week
        const upcoming = activeTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = startOfDay(parseISO(t.dueDate));
          return !isSameDay(d, todayStart) && !isBefore(d, todayStart) && d <= weekEnd;
        });
        return { tabTasks: { due, upcoming }, tabLabel: "Today's Quests" };
      } else {
        // Past/future week: incomplete tasks due in that week only
        const week = activeTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = startOfDay(parseISO(t.dueDate));
          return d >= weekStart && d <= weekEnd;
        });
        return { tabTasks: { due: week, upcoming: [] }, tabLabel: dateLabel + " Quests" };
      }
    }

    if (activeTab === 'weekly') {
      // Incomplete tasks due this month only
      const due = activeTasks.filter(t => {
        if (!t.dueDate) return false;
        return isSameMonth(parseISO(t.dueDate), currentDate);
      });
      return { tabTasks: { due, upcoming: [] }, tabLabel: format(currentDate, 'MMMM') + ' Quests' };
    }

    // Monthly — last 6 months window, incomplete only
    const sixAgo = subMonths(currentDate, 5);
    const windowStart = startOfMonth(sixAgo);
    const windowEnd = endOfMonth(currentDate);
    const due = activeTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = parseISO(t.dueDate);
      return d >= windowStart && d <= windowEnd;
    });
    return { tabTasks: { due, upcoming: [] }, tabLabel: 'Recent Quests' };
  }, [activeTab, dateOffset, activeTasks, tasks, currentDate]);

  // ── Habits filtered by tab + sorted: needs-action first ──────────────────
  const visibleHabits = useMemo(() => {
    // 1. Filter by tab
    let filtered: typeof activeHabits;
    if (activeTab === 'daily') {
      filtered = activeHabits.filter(h =>
        ['daily', 'every_2_days', 'every_3_days', 'every_4_days', 'specific_days'].includes(h.frequency)
      );
    } else if (activeTab === 'weekly') {
      filtered = activeHabits.filter(h => h.frequency === 'weekly');
    } else {
      filtered = activeHabits.filter(h => h.frequency === 'monthly');
    }

    // 2. Determine if habit is scheduled for current view/period
    const isScheduled = (h: typeof activeHabits[0]): boolean => {
      if (activeTab === 'weekly') return h.frequency === 'weekly';
      if (activeTab === 'monthly') return h.frequency === 'monthly';
      return isHabitDueToday(h);
    };

    // 3. Sort: scheduled (0) before not-scheduled (1), stable by createdAt within each group
    return [...filtered].sort((a, b) => {
      const aSched = isScheduled(a);
      const bSched = isScheduled(b);
      if (aSched !== bSched) return aSched ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [activeHabits, activeTab]);

  const hasTasks = (tabTasks as any).due.length > 0 || (tabTasks as any).upcoming?.length > 0;

  const showTasks   = showFilter === 'both' || showFilter === 'tasks';
  const showRituals = showFilter === 'both' || showFilter === 'rituals';
  const hasContent  = (showRituals && visibleHabits.length > 0) || (showTasks && hasTasks);

  return (
    <>
      {selectedHabit && (
        <RitualStats habit={selectedHabit} onBack={() => setSelectedHabitId(null)} />
      )}
      {!selectedHabit && (
    <div className="flex flex-col gap-0 w-full max-w-5xl mx-auto pb-32">

      {/* ── Sticky header: compact view/type/date controls ────────────────── */}
      <div className="sticky top-0 z-30 pt-3 pb-4">
        <div className="flex flex-wrap items-center gap-2 w-full bg-white/80 backdrop-blur-xl border border-[#E2E8F0] shadow-sm rounded-2xl p-2">
          <div className="flex items-center gap-1 w-full sm:w-auto sm:flex-1 min-w-0">
            <span className="px-2 text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">View</span>
            <div className="relative flex items-center bg-[#F1F4F9] p-0.5 rounded-full border border-[#E2E8F0] gap-0.5 flex-1 sm:flex-none min-w-0">
              {([
                { key: 'daily', label: 'Week' },
                { key: 'weekly', label: 'Month' },
                { key: 'monthly', label: '6 Months' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setDirection(0); setActiveTab(key); setDateOffset(0); }}
                  className={cn(
                    "relative flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-200 cursor-pointer z-10 whitespace-nowrap",
                    activeTab === key ? "text-[#1E293B]" : "text-[#94A3B8] hover:text-[#64748B]"
                  )}
                >
                  {activeTab === key && (
                    <motion.div
                      layoutId="combined-tab-pill"
                      className="absolute inset-0 bg-white rounded-full shadow-sm border border-[#E2E8F0]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto sm:flex-1 min-w-0">
            <span className="px-2 text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Type</span>
            <div className="flex items-center bg-[#F1F4F9] border border-[#E2E8F0] rounded-full p-0.5 gap-0.5 flex-1 sm:flex-none min-w-0">
              {([
                { key: 'both',    label: 'All',    Icon: LayoutGrid },
                { key: 'tasks',   label: 'Tasks',   Icon: ListTodo },
                { key: 'rituals', label: 'Habits', Icon: Flame },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setShowFilter(key)}
                  className={cn(
                    "relative flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-200 z-10 whitespace-nowrap",
                    showFilter === key ? "text-[#1E293B]" : "text-[#94A3B8] hover:text-[#64748B]"
                  )}
                >
                  {showFilter === key && (
                    <motion.div
                      layoutId="filter-pill"
                      className="absolute inset-0 bg-white rounded-full border border-[#E2E8F0]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", key === 'rituals' && showFilter === key && "fill-orange-400 text-orange-400")} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-2 py-1.5 w-full sm:w-auto sm:ml-auto">
            <button
              onClick={() => { setDirection(-1); setDateOffset(p => p - 1); }}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#F1F4F9] transition-all active:scale-90"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#64748B]" />
            </button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={`${activeTab}-${dateOffset}`}
                initial={{ opacity: 0, y: direction > 0 ? -6 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction > 0 ? 6 : -6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#1E293B] min-w-[100px] sm:min-w-[120px] text-center"
              >
                {dateLabel}
              </motion.span>
            </AnimatePresence>
            <button
              onClick={() => { setDirection(1); setDateOffset(p => p + 1); }}
              disabled={dateOffset >= 0}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90",
                dateOffset >= 0 ? "opacity-25 cursor-not-allowed" : "hover:bg-[#F1F4F9]"
              )}
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
            </button>
          </div>
        </div>
      </div>


      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden relative w-full pt-2">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={`${activeTab}-${dateOffset}`}
            custom={direction}
            variants={{
              initial: (d: number) => ({ opacity: 0, x: d === 0 ? 0 : d > 0 ? 80 : -80 }),
              animate: { opacity: 1, x: 0 },
              exit:    (d: number) => ({ opacity: 0, x: d === 0 ? 0 : d > 0 ? -80 : 80 }),
            }}
            initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="flex flex-col gap-8"
          >
            {!hasContent ? (
              /* Empty state */
              <div className="py-28 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-6 bg-[#F1F4F9]/30 rounded-[3rem] border-2 border-b-8 border-dashed border-[#E2E8F0]">
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-2 border-b-4 border-[#E2E8F0] shadow-inner">
                  <Target className="w-12 h-12 text-[#CBD5E1]" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#1E293B] uppercase tracking-tight">Nothing here</h3>
                  <p className="text-[#64748B]/60 font-medium mt-1">No rituals or quests for this period.</p>
                </div>
                <AddHabitDialog onAddHabit={onAddHabit}>
                  <button className="mt-2 border-2 border-b-[6px] border-[#4f46e5] bg-[#6366f1] text-white font-black uppercase tracking-widest active:translate-y-[2px] active:border-b-[4px] transition-all rounded-2xl py-4 px-8 text-base relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-px bg-white/40 z-10 pointer-events-none" />
                    Create Ritual
                  </button>
                </AddHabitDialog>
              </div>
            ) : (
              <>
                {/* ── Tasks section ────────────────────────────────────── */}
                {showTasks && hasTasks && (
                  <section className="space-y-3">
                    <TaskList
                      tasks={(tabTasks as any).due}
                      listType="active"
                      onToggleTask={onToggleTask}
                      onDeleteTask={onDeleteTask}
                      onEditTask={onEditTask}
                      onAddSubtask={onAddSubtask}
                      onToggleSubtask={onToggleSubtask}
                      setCelebrating={setCelebrating}
                    />
                    {(tabTasks as any).upcoming?.length > 0 && (
                      <TaskList
                        tasks={(tabTasks as any).upcoming}
                        listType="active"
                        onToggleTask={onToggleTask}
                        onDeleteTask={onDeleteTask}
                        onEditTask={onEditTask}
                        onAddSubtask={onAddSubtask}
                        onToggleSubtask={onToggleSubtask}
                        setCelebrating={setCelebrating}
                      />
                    )}
                  </section>
                )}

                {/* ── Rituals section ──────────────────────────────────── */}
                {showRituals && visibleHabits.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
                      <h2 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground/70">
                        Rituals
                      </h2>
                    </div>
                    <div className="flex flex-col gap-0">
                      <AnimatePresence mode="popLayout">
                        {visibleHabits.map(habit => (
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
                  </section>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
      )}
    </>
  );
}
