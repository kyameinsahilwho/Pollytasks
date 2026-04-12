"use client";

import { useState, useRef, useMemo, useEffect, memo, useCallback } from "react";
import { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Trash2, Flame, BarChart2, Edit2, ChevronDown, ChevronUp, Plus, CircleDashed, Archive, MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, isToday, parseISO, eachDayOfInterval, eachWeekOfInterval,
  startOfWeek, endOfWeek, startOfDay, startOfMonth, endOfMonth,
  isSameMonth, isSameWeek, subMonths, differenceInCalendarDays, isFuture, isBefore,
} from "date-fns";
import { EditHabitDialog } from "./edit-habit-dialog";
import confetti from 'canvas-confetti';
import { playCompletionSound } from "@/lib/sounds";

interface HabitItemProps {
  habit: Habit;
  currentDate?: Date;
  onToggle: (habitId: string, date: string) => void;
  onUpdate: (id: string, habitData: Partial<Omit<Habit, 'id' | 'currentStreak' | 'bestStreak' | 'createdAt' | 'completions'>>) => void;
  onDelete: (id: string) => void;
  onViewStats: (habitId: string) => void;
}

// ─── Aesthetics ───────────────────────────────────────────────────────────────
function getHabitCardAesthetics(colorStr?: string) {
  const base = {
    card: "bg-card border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600",
    checkbox: "bg-zinc-600 border-zinc-700",
    iconBg: "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500",
  };
  if (!colorStr) return base;
  const match = colorStr.match(/bg-([a-z]+)-\d/);
  if (!match?.[1]) return base;
  const c = match[1];
  const themes: Record<string, typeof base> = {
    blue:    { card: "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 hover:border-blue-400",       checkbox: "bg-blue-600 border-blue-700",    iconBg: "bg-blue-200 dark:bg-blue-900/50 border-blue-300 dark:border-blue-800 text-blue-700" },
    purple:  { card: "bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 hover:border-purple-400", checkbox: "bg-purple-600 border-purple-700", iconBg: "bg-purple-200 dark:bg-purple-900/50 border-purple-300 dark:border-purple-800 text-purple-700" },
    cyan:    { card: "bg-cyan-100 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 hover:border-cyan-400",       checkbox: "bg-cyan-600 border-cyan-700",    iconBg: "bg-cyan-200 dark:bg-cyan-900/50 border-cyan-300 dark:border-cyan-800 text-cyan-700" },
    rose:    { card: "bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 hover:border-rose-400",       checkbox: "bg-rose-600 border-rose-700",    iconBg: "bg-rose-200 dark:bg-rose-900/50 border-rose-300 dark:border-rose-800 text-rose-700" },
    amber:   { card: "bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 hover:border-amber-400",   checkbox: "bg-amber-600 border-amber-700",  iconBg: "bg-amber-200 dark:bg-amber-900/50 border-amber-300 dark:border-amber-800 text-amber-700" },
    indigo:  { card: "bg-indigo-100 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 hover:border-indigo-400", checkbox: "bg-indigo-600 border-indigo-700", iconBg: "bg-indigo-200 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-800 text-indigo-700" },
    emerald: { card: "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400", checkbox: "bg-emerald-600 border-emerald-700", iconBg: "bg-emerald-200 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-800 text-emerald-700" },
    orange:  { card: "bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 hover:border-orange-400", checkbox: "bg-orange-600 border-orange-700", iconBg: "bg-orange-200 dark:bg-orange-900/50 border-orange-300 dark:border-orange-800 text-orange-700" },
    pink:    { card: "bg-pink-100 dark:bg-pink-950/40 border-pink-300 dark:border-pink-800 hover:border-pink-400",       checkbox: "bg-pink-600 border-pink-700",    iconBg: "bg-pink-200 dark:bg-pink-900/50 border-pink-300 dark:border-pink-800 text-pink-700" },
    violet:  { card: "bg-violet-100 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 hover:border-violet-400", checkbox: "bg-violet-600 border-violet-700", iconBg: "bg-violet-200 dark:bg-violet-900/50 border-violet-300 dark:border-violet-800 text-violet-700" },
    teal:    { card: "bg-teal-100 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 hover:border-teal-400",       checkbox: "bg-teal-600 border-teal-700",    iconBg: "bg-teal-200 dark:bg-teal-900/50 border-teal-300 dark:border-teal-800 text-teal-700" },
    sky:     { card: "bg-sky-100 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 hover:border-sky-400",           checkbox: "bg-sky-600 border-sky-700",      iconBg: "bg-sky-200 dark:bg-sky-900/50 border-sky-300 dark:border-sky-800 text-sky-700" },
    lime:    { card: "bg-lime-100 dark:bg-lime-950/40 border-lime-300 dark:border-lime-800 hover:border-lime-400",       checkbox: "bg-lime-600 border-lime-700",    iconBg: "bg-lime-200 dark:bg-lime-900/50 border-lime-300 dark:border-lime-800 text-lime-700" },
    yellow:  { card: "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 hover:border-yellow-400", checkbox: "bg-yellow-600 border-yellow-700", iconBg: "bg-yellow-200 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-800 text-yellow-700" },
    fuchsia: { card: "bg-fuchsia-100 dark:bg-fuchsia-950/40 border-fuchsia-300 dark:border-fuchsia-800 hover:border-fuchsia-400", checkbox: "bg-fuchsia-600 border-fuchsia-700", iconBg: "bg-fuchsia-200 dark:bg-fuchsia-900/50 border-fuchsia-300 dark:border-fuchsia-800 text-fuchsia-700" },
    slate:   { card: "bg-slate-100 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 hover:border-slate-400", checkbox: "bg-slate-600 border-slate-700",   iconBg: "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700" },
  };
  return themes[c] ?? base;
}

function getFrequencyLabel(freq: Habit['frequency']) {
  switch (freq) {
    case 'daily':         return 'Daily';
    case 'weekly':        return 'Weekly';
    case 'monthly':       return 'Monthly';
    case 'every_2_days':  return 'Every 2 days';
    case 'every_3_days':  return 'Every 3 days';
    case 'every_4_days':  return 'Every 4 days';
    case 'specific_days': return 'Custom';
    default:              return freq;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export const HabitItem = memo(function HabitItem({
  habit, currentDate = new Date(), onToggle, onUpdate, onDelete, onViewStats,
}: HabitItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // ── Optimistic completions ────────────────────────────────────────────────
  const [optimisticCompletions, setOptimisticCompletions] = useState(habit.completions);
  useEffect(() => { setOptimisticCompletions(habit.completions); }, [habit.completions]);

  const aesthetics = useMemo(() => getHabitCardAesthetics(habit.color), [habit.color]);

  const themeColors = useMemo(() => ({
    text:   habit.color ? aesthetics.checkbox.replace('bg-', 'text-').split(' ')[0] : 'text-[#0F172A]',
    border: habit.color ? aesthetics.card.split(' ')[1] : 'border-[#CBD5E1]',
  }), [habit.color, aesthetics]);

  // ── Week days ─────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 0 }),
    end:   endOfWeek(currentDate,   { weekStartsOn: 0 }),
  }), [currentDate]);

  // ── Periods (weekly / monthly) ────────────────────────────────────────────
  const now = new Date();
  const periods = useMemo(() => {
    if (habit.frequency === 'weekly') {
      return eachWeekOfInterval(
        { start: startOfMonth(currentDate), end: endOfMonth(currentDate) },
        { weekStartsOn: 0 }
      ).map((date, i) => ({ date, label: `W${i + 1}`, isCurrent: isSameWeek(date, now, { weekStartsOn: 0 }) }));
    }
    if (habit.frequency === 'monthly') {
      return Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(currentDate, i);
        return { date, label: format(date, 'MMM'), isCurrent: isSameMonth(date, now) };
      }).reverse();
    }
    return [];
  }, [habit.frequency, currentDate]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isDateCompleted = useCallback((date: Date) =>
    optimisticCompletions.some(c =>
      startOfDay(parseISO(c.completedAt)).getTime() === startOfDay(date).getTime()
    ), [optimisticCompletions]);

  const isDayScheduled = useCallback((date: Date) => {
    if (habit.frequency === 'specific_days') return habit.customDays?.includes(date.getDay()) ?? false;
    if (['every_2_days', 'every_3_days', 'every_4_days'].includes(habit.frequency)) {
      const interval = parseInt(habit.frequency.split('_')[1]);
      const origin = startOfDay(parseISO(habit.createdAt));
      const diff = differenceInCalendarDays(startOfDay(date), origin);
      return diff >= 0 && diff % interval === 0;
    }
    return true;
  }, [habit.frequency, habit.customDays, habit.createdAt]);

  // ── Progress stats ────────────────────────────────────────────────────────
  const { done, total, isScheduledToday, completedToday } = useMemo(() => {
    if (habit.frequency === 'weekly') {
      const done = periods.filter(p => optimisticCompletions.some(c => isSameWeek(parseISO(c.completedAt), p.date, { weekStartsOn: 0 }))).length;
      const completedToday = periods.some(p => p.isCurrent && optimisticCompletions.some(c => isSameWeek(parseISO(c.completedAt), p.date, { weekStartsOn: 0 })));
      return { done, total: periods.length, isScheduledToday: periods.some(p => p.isCurrent), completedToday };
    }
    if (habit.frequency === 'monthly') {
      const done = periods.filter(p => optimisticCompletions.some(c => isSameMonth(parseISO(c.completedAt), p.date))).length;
      const completedToday = periods.some(p => p.isCurrent && optimisticCompletions.some(c => isSameMonth(parseISO(c.completedAt), p.date)));
      return { done, total: periods.length, isScheduledToday: periods.some(p => p.isCurrent), completedToday };
    }
    let done = 0, total = 0;
    weekDays.forEach(day => {
      if (!isDayScheduled(day)) return;
      total++;
      if (isDateCompleted(day)) done++;
    });
    const todayInWeek = weekDays.find(d => isToday(d));
    return {
      done, total,
      isScheduledToday: todayInWeek ? isDayScheduled(todayInWeek) : false,
      completedToday:   todayInWeek ? isDateCompleted(todayInWeek) : false,
    };
  }, [habit.frequency, periods, weekDays, isDayScheduled, isDateCompleted, optimisticCompletions]);

  const progress = total > 0 ? Math.min((done / total) * 100, 100) : 0;

  // ── Toggle ────────────────────────────────────────────────────────────────
  const handleToggle = useCallback((date: Date, e?: React.MouseEvent) => {
    const isoDate = date.toISOString();
    const alreadyDone = isDateCompleted(date);
    setOptimisticCompletions(prev =>
      alreadyDone
        ? prev.filter(c => startOfDay(parseISO(c.completedAt)).getTime() !== startOfDay(date).getTime())
        : [...prev, { id: 'opt-' + Date.now(), habitId: habit.id, completedAt: isoDate }]
    );
    if (!alreadyDone) {
      playCompletionSound();
      if (cardRef.current && e) {
        const rect = cardRef.current.getBoundingClientRect();
        confetti({
          particleCount: 40, spread: 60,
          origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
          colors: ['#ffffff', '#ffd700', '#6366f1'],
          startVelocity: 30, ticks: 100, gravity: 1.2, scalar: 0.7,
        });
      }
    }
    onToggle(habit.id, isoDate);
  }, [habit.id, isDateCompleted, onToggle]);

  // ── Past logging items for the ⋯ menu ─────────────────────────────────────
  // Daily / interval / specific_days → past days in the viewed week
  const pastDays = useMemo(() =>
    weekDays.filter(d => !isToday(d) && !isFuture(d) && isDayScheduled(d)),
  [weekDays, isDayScheduled]);

  const isDailyType = ['daily', 'specific_days', 'every_2_days', 'every_3_days', 'every_4_days'].includes(habit.frequency);
  const hasPastDays = isDailyType && pastDays.length > 0;

  // Weekly → past weeks in the viewed month (from periods)
  const pastWeeks = useMemo(() => {
    if (habit.frequency !== 'weekly') return [];
    return periods.filter(p => !p.isCurrent && isBefore(p.date, new Date()));
  }, [habit.frequency, periods]);

  // Monthly → past months in the 6-month window (from periods)
  const pastMonths = useMemo(() => {
    if (habit.frequency !== 'monthly') return [];
    return periods.filter(p => !p.isCurrent && isBefore(p.date, new Date()));
  }, [habit.frequency, periods]);

  // ── Close menu on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h as any);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h as any); };
  }, [showMenu]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col p-3 md:p-4 border-2 border-b-4 rounded-2xl md:rounded-[2rem] transition-all shadow-sm mb-2",
        aesthetics.card,
        isExpanded && "border-b-[6px] shadow-md"
      )}
    >
      {/* ── Main row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">

        {/* Left: icon + title (clickable to expand) */}
        <div
          className="flex items-center gap-3 min-w-[140px] md:min-w-[180px] cursor-pointer flex-1"
          onClick={() => setIsExpanded(v => !v)}
        >
          <div className={cn(
            "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shadow-inner border-2 border-b-4 flex-shrink-0",
            aesthetics.iconBg
          )}>
            {habit.icon || <CircleDashed className="w-6 h-6 text-gray-400" />}
          </div>
          <div className="flex flex-col flex-1">
            <h3 className={cn(
              "font-black text-sm md:text-base leading-tight uppercase tracking-tight flex items-center gap-2",
              themeColors.text
            )}>
              {habit.title}
              {isExpanded ? <ChevronUp className="w-4 h-4 opacity-40" /> : <ChevronDown className="w-4 h-4 opacity-40" />}
            </h3>
            <div className="flex items-center gap-2">
              <Flame className={cn("w-3 h-3 fill-current", habit.currentStreak > 0 ? "text-orange-500" : "text-gray-300")} />
              <span className={cn("text-[10px] font-black uppercase tracking-wider", habit.currentStreak > 0 ? "text-orange-500" : "text-gray-300")}>
                {habit.currentStreak} streak
              </span>
              <div className="h-1 w-1 rounded-full bg-gray-300" />
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                {getFrequencyLabel(habit.frequency)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: progress + ADD button + ⋯ dots */}
        <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">

          {/* Progress pill */}
          <div className="flex items-center gap-2 flex-1 max-w-[180px]">
            <div className="relative h-4 flex-1 bg-zinc-200/50 dark:bg-zinc-800 rounded-full border border-zinc-300/50 dark:border-zinc-700 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
              <motion.div
                className={cn("h-full relative", aesthetics.checkbox)}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <div className="absolute top-0.5 left-1 right-1 h-1 bg-white/30 rounded-full pointer-events-none" />
              </motion.div>
            </div>
            <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
              {done} / {total}
            </span>
          </div>

          {/* ADD / Done toggle */}
          {isScheduledToday && (
            <motion.button
              onClick={e => { e.stopPropagation(); handleToggle(new Date(), e); }}
              whileTap={{ scale: 0.92 }}
              className={cn(
                "h-11 px-4 rounded-2xl border-2 border-b-4 flex items-center justify-center flex-shrink-0 min-w-[100px] transition-colors select-none",
                completedToday
                  ? cn(aesthetics.checkbox, "text-white")
                  : cn("bg-white", themeColors.border)
              )}
            >
              {completedToday ? (
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                  <span className="text-xs font-black tracking-tight uppercase text-white">Done</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Plus className={cn("w-4 h-4 stroke-[3]", themeColors.text)} />
                  <span className={cn("text-xs font-black tracking-tight uppercase", themeColors.text)}>Add</span>
                </div>
              )}
            </motion.button>
          )}

          {/* ⋯ Three-dots menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
              className={cn(
                "w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center transition-all active:translate-y-[2px] active:border-b-0",
                "bg-white/70 border-zinc-200 hover:bg-white hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700"
              )}
            >
              <MoreHorizontal className="w-4 h-4 text-zinc-500" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 bottom-[calc(100%+8px)] z-50 bg-white dark:bg-zinc-900 border-2 border-b-4 border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden"
                >
                  {/* ── Daily / interval / specific_days: show day-dot buttons ── */}
                  {isDailyType && (
                    hasPastDays ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap shrink-0">Past days</p>
                        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                        <div className="flex gap-1.5">
                          {pastDays.map(day => {
                            const done = isDateCompleted(day);
                            return (
                              <button
                                key={day.toISOString()}
                                onClick={e => { e.stopPropagation(); handleToggle(day); setShowMenu(false); }}
                                title={format(day, 'EEEE, MMM d')}
                                className={cn(
                                  "flex flex-col items-center w-9 rounded-xl py-1.5 border-2 border-b-[3px] transition-all active:translate-y-[1px] active:border-b-0 flex-shrink-0",
                                  done
                                    ? cn(aesthetics.checkbox, "border-b-0 translate-y-[1px] text-white")
                                    : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 hover:border-zinc-300"
                                )}
                              >
                                <span className={cn("text-[8px] font-black uppercase", done ? "text-white/70" : "text-zinc-400")}>
                                  {format(day, 'EEE')[0]}
                                </span>
                                <span className={cn("text-[11px] font-black leading-tight", done ? "text-white" : "text-zinc-600 dark:text-zinc-300")}>
                                  {format(day, 'd')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap">All caught up!</p>
                      </div>
                    )
                  )}

                  {/* ── Weekly: show past week buttons ──────────────────── */}
                  {habit.frequency === 'weekly' && (
                    pastWeeks.length > 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap shrink-0">Past weeks</p>
                        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                        <div className="flex gap-1.5">
                          {pastWeeks.map(p => {
                            const done = optimisticCompletions.some(c =>
                              isSameWeek(parseISO(c.completedAt), p.date, { weekStartsOn: 0 })
                            );
                            return (
                              <button
                                key={p.date.toISOString()}
                                onClick={e => { e.stopPropagation(); handleToggle(p.date); setShowMenu(false); }}
                                title={`Week of ${format(p.date, 'MMM d')}`}
                                className={cn(
                                  "flex flex-col items-center w-9 rounded-xl py-1.5 border-2 border-b-[3px] transition-all active:translate-y-[1px] active:border-b-0 flex-shrink-0",
                                  done
                                    ? cn(aesthetics.checkbox, "border-b-0 translate-y-[1px] text-white")
                                    : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 hover:border-zinc-300"
                                )}
                              >
                                <span className={cn("text-[8px] font-black uppercase", done ? "text-white/70" : "text-zinc-400")}>W</span>
                                <span className={cn("text-[11px] font-black leading-tight", done ? "text-white" : "text-zinc-600 dark:text-zinc-300")}>
                                  {p.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap">No past weeks</p>
                      </div>
                    )
                  )}

                  {/* ── Monthly: show past month buttons ────────────────── */}
                  {habit.frequency === 'monthly' && (
                    pastMonths.length > 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap shrink-0">Past months</p>
                        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                        <div className="flex gap-1.5">
                          {pastMonths.map(p => {
                            const done = optimisticCompletions.some(c =>
                              isSameMonth(parseISO(c.completedAt), p.date)
                            );
                            return (
                              <button
                                key={p.date.toISOString()}
                                onClick={e => { e.stopPropagation(); handleToggle(p.date); setShowMenu(false); }}
                                title={format(p.date, 'MMMM yyyy')}
                                className={cn(
                                  "flex flex-col items-center w-9 rounded-xl py-1.5 border-2 border-b-[3px] transition-all active:translate-y-[1px] active:border-b-0 flex-shrink-0",
                                  done
                                    ? cn(aesthetics.checkbox, "border-b-0 translate-y-[1px] text-white")
                                    : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 hover:border-zinc-300"
                                )}
                              >
                                <span className={cn("text-[8px] font-black uppercase", done ? "text-white/70" : "text-zinc-400")}>Mo</span>
                                <span className={cn("text-[11px] font-black leading-tight", done ? "text-white" : "text-zinc-600 dark:text-zinc-300")}>
                                  {p.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap">No past months</p>
                      </div>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Expanded panel — actions (Stats, Edit, Archive, Delete) ──────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-3 mt-3 border-t-2 border-black/5 dark:border-white/10 flex-wrap">
              <Button
                variant="outline" size="sm"
                onClick={() => onViewStats(habit.id)}
                className="flex-1 border-2 border-b-4 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl active:translate-y-0.5 active:border-b-0 transition-all bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F4F9] hover:text-[#1E293B] hover:border-[#CBD5E1]"
              >
                <BarChart2 className="w-4 h-4 mr-2" />Stats
              </Button>
              <EditHabitDialog habit={habit} onUpdateHabit={onUpdate}>
                <Button
                  variant="outline" size="sm"
                  className="flex-1 border-2 border-b-4 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl active:translate-y-0.5 active:border-b-0 transition-all bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F4F9] hover:text-[#1E293B] hover:border-[#CBD5E1]"
                >
                  <Edit2 className="w-4 h-4 mr-2" />Edit
                </Button>
              </EditHabitDialog>
              <Button
                variant="outline" size="sm"
                onClick={() => onUpdate(habit.id, { archived: true })}
                className="flex-1 border-2 border-b-4 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl active:translate-y-0.5 active:border-b-0 transition-all bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F4F9] hover:text-[#1E293B] hover:border-[#CBD5E1]"
              >
                <Archive className="w-4 h-4 mr-2" />Archive
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline" size="sm"
                    className="bg-rose-50 border-2 border-b-4 border-rose-100 text-rose-300 font-black uppercase tracking-widest text-[10px] h-10 px-4 rounded-xl hover:bg-rose-100 hover:text-rose-500 active:translate-y-0.5 active:border-b-0 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Habit</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this habit? All history and stats will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onUpdate(habit.id, { archived: true })}>Archive</AlertDialogAction>
                    <AlertDialogAction onClick={() => onDelete(habit.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
