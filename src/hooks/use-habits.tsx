"use client";

import { useMemo, useCallback, useState, useEffect } from 'react';
import { Habit } from '@/lib/types';
import {
  startOfDay,
  parseISO,
  differenceInCalendarDays,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  isSameWeek,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameMonth
} from 'date-fns';
import { XP_PER_RITUAL, STREAK_XP_BONUS, MAX_STREAK_BONUS } from '@/lib/level-system';
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

// Optimistic update storage key
const OPTIMISTIC_HABITS_KEY = 'pollytasks_optimistic_habits';

// Cache key for localStorage-first approach
const CACHE_KEY_HABITS = 'pollytasks_cache_habits';

// Cache expiry in milliseconds (10 minutes)
const CACHE_EXPIRY = 10 * 60 * 1000;

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed: CachedData<T> = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_EXPIRY;

    if (isExpired) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    if (typeof window === 'undefined') return;
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (e) {
    console.error("Failed to cache habits data:", e);
  }
}

const calculateMaxGap = (frequency: Habit['frequency'], customDays?: number[]) => {
  if (frequency === 'every_2_days') return 2;
  if (frequency === 'every_3_days') return 3;
  if (frequency === 'every_4_days') return 4;
  if (frequency === 'weekly') return 7;
  if (frequency === 'monthly') return 31;

  if (frequency === 'specific_days' && customDays && customDays.length > 0) {
    const sortedDays = [...customDays].sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 0; i < sortedDays.length - 1; i++) {
      maxGap = Math.max(maxGap, sortedDays[i + 1] - sortedDays[i]);
    }
    maxGap = Math.max(maxGap, 7 - sortedDays[sortedDays.length - 1] + sortedDays[0]);
    return maxGap;
  }

  return 1; // daily
};

const calculateHabitXP = (completions: { completedAt: string }[], frequency: Habit['frequency'] = 'daily', customDays?: number[]) => {
  const sortedCompletions = [...completions]
    .map(c => startOfDay(parseISO(c.completedAt)))
    .sort((a, b) => a.getTime() - b.getTime());

  const totalXP = completions.length * XP_PER_RITUAL;

  let streakBonusXP = 0;
  if (sortedCompletions.length > 0) {
    let tempStreak = 1;
    const maxGap = calculateMaxGap(frequency, customDays);

    for (let i = 1; i < sortedCompletions.length; i++) {
      const diff = differenceInCalendarDays(sortedCompletions[i], sortedCompletions[i - 1]);
      if (diff <= maxGap) {
        tempStreak++;
        const bonus = Math.min(tempStreak * STREAK_XP_BONUS, MAX_STREAK_BONUS);
        streakBonusXP += bonus;
      } else {
        tempStreak = 1;
      }
    }
  }

  return totalXP + streakBonusXP;
};

const calculateYearlyStats = (
  completions: { completedAt: string }[],
  frequency: Habit['frequency'],
  createdAt: string,
  customDays?: number[]
) => {
  const now = new Date();
  const year = now.getFullYear();
  const start = startOfYear(now);
  const end = endOfYear(now);

  let totalExpected = 0;
  let achieved = 0;

  const completionDates = completions.map(c => startOfDay(parseISO(c.completedAt)));
  const completionDateTimes = new Set(completionDates.map(d => d.getTime()));

  if (frequency === 'daily' || frequency === 'specific_days' || ['every_2_days', 'every_3_days', 'every_4_days'].includes(frequency)) {
    const days = eachDayOfInterval({ start, end });
    days.forEach(day => {
      let isScheduled = true;
      if (frequency === 'specific_days') {
        isScheduled = customDays?.includes(day.getDay()) ?? false;
      } else if (['every_2_days', 'every_3_days', 'every_4_days'].includes(frequency)) {
        const interval = parseInt(frequency.split('_')[1]);
        const startDate = startOfDay(parseISO(createdAt));
        const diffDays = differenceInCalendarDays(startOfDay(day), startDate);
        isScheduled = diffDays >= 0 && diffDays % interval === 0;
      }

      if (isScheduled) {
        totalExpected++;
        if (completionDateTimes.has(day.getTime())) {
          achieved++;
        }
      }
    });
  } else if (frequency === 'weekly') {
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });
    totalExpected = weeks.length;
    weeks.forEach(week => {
      if (completions.some(c => isSameWeek(parseISO(c.completedAt), week, { weekStartsOn: 0 }))) {
        achieved++;
      }
    });
  } else if (frequency === 'monthly') {
    const months = eachMonthOfInterval({ start, end });
    totalExpected = months.length;
    months.forEach(month => {
      if (completions.some(c => isSameMonth(parseISO(c.completedAt), month))) {
        achieved++;
      }
    });
  }

  return { achieved, totalExpected, year };
};

import { isFirstTimeVisitor, getTemplateHabits } from '@/lib/template-data';

const mapHabit = (h: any, optimisticUpdates: any = {}): Habit => {
  const completions = (h.completions || []).map((c: any) => ({
    id: c._id,
    habitId: c.habitId,
    completedAt: c.completedAt
  }));

  const xp = calculateHabitXP(completions, h.frequency as any, h.customDays);
  const yearlyStats = calculateYearlyStats(completions, h.frequency as any, h.createdAt, h.customDays);

  const baseHabit: Habit = {
    id: h._id,
    title: h.title,
    description: h.description,
    frequency: h.frequency as any,
    currentStreak: h.currentStreak,
    bestStreak: h.bestStreak,
    color: h.color,
    icon: h.icon,
    createdAt: h.createdAt,
    customDays: h.customDays,
    completions,
    xp,
    totalCompletions: completions.length,
    yearlyStats,
    archived: h.archived,
    reminderTime: h.reminderTime,
    reminderEnabled: h.reminderEnabled,
  };

  // Apply optimistic updates if present
  const optimistic = optimisticUpdates[h._id];
  if (optimistic) {
    return { ...baseHabit, ...optimistic };
  }

  return baseHabit;
};

export const useHabits = (initialHabits?: Doc<"habits">[]) => {
  const { isAuthenticated: _realIsAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [forceLocal, setForceLocal] = useState(false);

  const isAuthenticated = _realIsAuthenticated && !forceLocal;

  const rawHabits = useQuery(api.habits.get);
  const addHabitMutation = useMutation(api.habits.add);
  const updateHabitMutation = useMutation(api.habits.update);
  const deleteHabitMutation = useMutation(api.habits.remove);
  const addCompletionMutation = useMutation(api.habits.addCompletion);
  const removeCompletionMutation = useMutation(api.habits.removeCompletion);

  // Challenge progress tracking
  const updateChallengeProgressMutation = useMutation(api.challenges.updateChallengeProgress);

  // Local State
  const [localHabits, setLocalHabits] = useState<Habit[]>([]);
  const [isLocalLoaded, setIsLocalLoaded] = useState(false);

  // Cached data for localStorage-first approach (authenticated users)
  const [cachedHabits] = useState<Habit[] | null>(() => getCachedData<Habit[]>(CACHE_KEY_HABITS));

  // Optimistic updates state - overlay on top of server data
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, Partial<Habit>>>({});

  // Load from LocalStorage
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading && !isLocalLoaded) {
      try {
        const storedHabits = localStorage.getItem('pollytasks_habits');

        if (!storedHabits && isFirstTimeVisitor()) {
          setLocalHabits(getTemplateHabits());
        } else if (storedHabits) {
          setLocalHabits(JSON.parse(storedHabits));
        }
      } catch (e) {
        console.error("Failed to load local habits", e);
      } finally {
        setIsLocalLoaded(true);
      }
    }
  }, [isAuthenticated, isAuthLoading, isLocalLoaded]);

  // Load optimistic updates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OPTIMISTIC_HABITS_KEY);
      if (stored) {
        setOptimisticUpdates(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load optimistic habit updates", e);
    }
  }, []);

  // Save optimistic updates to localStorage
  useEffect(() => {
    if (Object.keys(optimisticUpdates).length > 0) {
      localStorage.setItem(OPTIMISTIC_HABITS_KEY, JSON.stringify(optimisticUpdates));
    } else {
      localStorage.removeItem(OPTIMISTIC_HABITS_KEY);
    }
  }, [optimisticUpdates]);

  // Save to LocalStorage
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading && isLocalLoaded) {
      localStorage.setItem('pollytasks_habits', JSON.stringify(localHabits));
    }
  }, [localHabits, isAuthenticated, isAuthLoading, isLocalLoaded]);

  // Helper: Apply optimistic update
  const applyOptimisticUpdate = useCallback((habitId: string, update: Partial<Habit>) => {
    setOptimisticUpdates(prev => ({
      ...prev,
      [habitId]: { ...(prev[habitId] || {}), ...update }
    }));
  }, []);

  // Helper: Clear optimistic update
  const clearOptimisticUpdate = useCallback((habitId: string) => {
    setOptimisticUpdates(prev => {
      const next = { ...prev };
      delete next[habitId];
      return next;
    });
  }, []);

  const habits: Habit[] = useMemo(() => {
    if (isAuthenticated) {
      // Use cached data while server data is loading (localStorage-first)
      if (!rawHabits) {
        return (initialHabits !== undefined ? initialHabits.map(h => mapHabit(h, optimisticUpdates)) : cachedHabits) ?? [];
      }
      return rawHabits.map(h => mapHabit(h, optimisticUpdates)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      return localHabits;
    }
  }, [rawHabits, isAuthenticated, localHabits, optimisticUpdates, cachedHabits]);

  // Cache fresh habits data when received from server
  useEffect(() => {
    if (isAuthenticated && rawHabits !== undefined) {
      const mappedHabits: Habit[] = rawHabits.map(h => mapHabit(h, {}));
      setCachedData(CACHE_KEY_HABITS, mappedHabits);
    }
  }, [rawHabits, isAuthenticated]);

  const addHabit = useCallback(async (habitData: Omit<Habit, 'id' | 'currentStreak' | 'bestStreak' | 'createdAt' | 'completions'>) => {
    const createdAt = new Date().toISOString();
    const yearlyStats = calculateYearlyStats([], habitData.frequency, createdAt, habitData.customDays);

    const handleLocalAdd = () => {
      const newHabit: Habit = {
        id: crypto.randomUUID(),
        title: habitData.title,
        description: habitData.description,
        frequency: habitData.frequency,
        currentStreak: 0,
        bestStreak: 0,
        color: habitData.color,
        icon: habitData.icon,
        createdAt,
        customDays: habitData.customDays,
        totalCompletions: 0,
        yearlyStats,
        archived: habitData.archived,
        reminderTime: habitData.reminderTime || undefined,
        reminderEnabled: habitData.reminderEnabled,
        completions: [],
        xp: 0
      };
      setLocalHabits(prev => [...prev, newHabit]);
    };

    if (isAuthenticated) {
      try {
        await addHabitMutation({
          title: habitData.title,
          description: habitData.description,
          frequency: habitData.frequency,
          currentStreak: 0,
          bestStreak: 0,
          color: habitData.color || "#6366f1",
          icon: habitData.icon || "✨",
          createdAt,
          customDays: habitData.customDays,
          totalCompletions: 0,
          yearlyAchieved: yearlyStats.achieved,
          yearlyExpected: yearlyStats.totalExpected,
          statsYear: yearlyStats.year,
          archived: habitData.archived,
          reminderTime: habitData.reminderTime || undefined,
          reminderEnabled: habitData.reminderEnabled
        });
      } catch (error: any) {
        console.error("Mutation failed, falling back to local:", error);
        if (error.message?.includes("Unauthorized") || error.toString().includes("Unauthorized")) {
          setForceLocal(true);
          handleLocalAdd();
        } else {
          throw error;
        }
      }
    } else {
      handleLocalAdd();
    }
  }, [addHabitMutation, isAuthenticated]);

  // OPTIMISTIC toggle habit completion - instant UI update!
  const toggleHabitCompletion = useCallback(async (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const targetDate = startOfDay(parseISO(date)).toISOString();

    const existingCompletion = habit.completions.find(c =>
      startOfDay(parseISO(c.completedAt)).getTime() === startOfDay(parseISO(targetDate)).getTime()
    );

    let newCompletions = [...habit.completions];
    let added = false;
    let removedCompletionId: string | undefined;

    if (existingCompletion) {
      newCompletions = newCompletions.filter(c => c.id !== existingCompletion.id);
      removedCompletionId = existingCompletion.id;
    } else {
      newCompletions.push({ id: crypto.randomUUID(), habitId: habitId, completedAt: targetDate });
      added = true;
    }

    // Recalculate streak
    const sortedCompletions = [...newCompletions]
      .map(c => startOfDay(parseISO(c.completedAt)))
      .sort((a, b) => a.getTime() - b.getTime());

    let currentStreak = 0;
    let bestStreak = habit.bestStreak;

    if (sortedCompletions.length > 0) {
      const lastCompletion = sortedCompletions[sortedCompletions.length - 1];
      const maxGap = calculateMaxGap(habit.frequency, habit.customDays);

      if (differenceInCalendarDays(new Date(), lastCompletion) <= maxGap) {
        currentStreak = 1;
        for (let i = sortedCompletions.length - 2; i >= 0; i--) {
          const diff = differenceInCalendarDays(sortedCompletions[i + 1], sortedCompletions[i]);
          if (diff <= maxGap) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    bestStreak = Math.max(bestStreak, currentStreak);
    const yearlyStats = calculateYearlyStats(newCompletions, habit.frequency, habit.createdAt, habit.customDays);
    const xp = calculateHabitXP(newCompletions, habit.frequency, habit.customDays);

    // Store previous state for rollback
    const previousState = {
      completions: habit.completions,
      currentStreak: habit.currentStreak,
      bestStreak: habit.bestStreak,
      totalCompletions: habit.totalCompletions,
      yearlyStats: habit.yearlyStats,
      xp: habit.xp
    };

    if (isAuthenticated) {
      // 🚀 OPTIMISTIC UPDATE - Update UI immediately!
      applyOptimisticUpdate(habitId, {
        completions: newCompletions,
        currentStreak,
        bestStreak,
        totalCompletions: newCompletions.length,
        yearlyStats,
        xp
      });

      // Sync to database in background
      try {
        if (added) {
          await addCompletionMutation({ habitId: habitId as Id<"habits">, completedAt: targetDate });
        } else if (removedCompletionId) {
          await removeCompletionMutation({ completionId: removedCompletionId as Id<"habitCompletions"> });
        }

        await updateHabitMutation({
          id: habitId as Id<"habits">,
          currentStreak,
          bestStreak,
          totalCompletions: newCompletions.length,
          yearlyAchieved: yearlyStats.achieved,
          yearlyExpected: yearlyStats.totalExpected,
          statsYear: yearlyStats.year
        });

        // Clear optimistic update after successful sync
        clearOptimisticUpdate(habitId);

        // 📊 Update challenge progress if habit was completed (not uncompleted)
        if (added) {
          try {
            await updateChallengeProgressMutation({ type: "habit", value: 1 });
          } catch (err) {
            console.error("Failed to update challenge progress:", err);
            // Don't fail the habit completion if challenge update fails
          }
        }
      } catch (error: any) {
        console.error("Mutation failed, rolling back:", error);

        // ⏪ ROLLBACK on failure
        if (error.message?.includes("Unauthorized") || error.toString().includes("Unauthorized")) {
          setForceLocal(true);
          clearOptimisticUpdate(habitId);
          setLocalHabits(prev => prev.map(h =>
            h.id === habitId ? {
              ...h,
              currentStreak,
              bestStreak,
              totalCompletions: newCompletions.length,
              yearlyStats,
              completions: newCompletions,
              xp
            } : h
          ));
        } else {
          // Rollback immediately by clearing the optimistic update
          clearOptimisticUpdate(habitId);
          throw error;
        }
      }
    } else {
      // Local-only update
      setLocalHabits(prev => prev.map(h =>
        h.id === habitId ? {
          ...h,
          currentStreak,
          bestStreak,
          totalCompletions: newCompletions.length,
          yearlyStats,
          completions: newCompletions,
          xp
        } : h
      ));
    }

  }, [habits, addCompletionMutation, removeCompletionMutation, updateHabitMutation, isAuthenticated, applyOptimisticUpdate, clearOptimisticUpdate]);

  const addHabitCompletion = useCallback(async (habitId: string, date: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const targetDate = startOfDay(parseISO(date)).toISOString();
    const newCompletions = [...habit.completions, { id: crypto.randomUUID(), habitId: habitId, completedAt: targetDate }];

    // Recalculate streak
    const sortedCompletions = [...newCompletions]
      .map(c => startOfDay(parseISO(c.completedAt)))
      .sort((a, b) => a.getTime() - b.getTime());

    let currentStreak = 0;
    if (sortedCompletions.length > 0) {
      const lastCompletion = sortedCompletions[sortedCompletions.length - 1];
      const maxGap = calculateMaxGap(habit.frequency, habit.customDays);
      if (differenceInCalendarDays(new Date(), lastCompletion) <= maxGap) {
        currentStreak = 1;
        for (let i = sortedCompletions.length - 2; i >= 0; i--) {
          const diff = differenceInCalendarDays(sortedCompletions[i + 1], sortedCompletions[i]);
          if (diff <= maxGap) currentStreak++;
          else break;
        }
      }
    }

    const bestStreak = Math.max(habit.bestStreak, currentStreak);
    const yearlyStats = calculateYearlyStats(newCompletions, habit.frequency, habit.createdAt, habit.customDays);
    const xp = calculateHabitXP(newCompletions, habit.frequency, habit.customDays);

    if (isAuthenticated) {
      applyOptimisticUpdate(habitId, {
        completions: newCompletions,
        currentStreak,
        bestStreak,
        totalCompletions: newCompletions.length,
        yearlyStats,
        xp
      });

      try {
        await addCompletionMutation({ habitId: habitId as Id<"habits">, completedAt: targetDate });
        await updateHabitMutation({
          id: habitId as Id<"habits">,
          currentStreak,
          bestStreak,
          totalCompletions: newCompletions.length,
          yearlyAchieved: yearlyStats.achieved,
          yearlyExpected: yearlyStats.totalExpected,
          statsYear: yearlyStats.year
        });
        clearOptimisticUpdate(habitId);
        await updateChallengeProgressMutation({ type: "habit", value: 1 });
      } catch (error) {
        console.error("Mutation failed, rolling back:", error);
        clearOptimisticUpdate(habitId);
        throw error;
      }
    } else {
      setLocalHabits(prev => prev.map(h =>
        h.id === habitId ? {
          ...h,
          currentStreak,
          bestStreak,
          totalCompletions: newCompletions.length,
          yearlyStats,
          completions: newCompletions,
          xp
        } : h
      ));
    }
  }, [habits, addCompletionMutation, updateHabitMutation, isAuthenticated, applyOptimisticUpdate, clearOptimisticUpdate, updateChallengeProgressMutation]);

  const updateHabit = useCallback(async (id: string, updates: Partial<Omit<Habit, 'id' | 'createdAt' | 'completions'>>) => {
    const handleLocalUpdate = () => {
      setLocalHabits(prev => prev.map(h => {
        if (h.id === id) {
          const updatedHabit = { ...h, ...updates };
          if (updates.frequency || updates.customDays) {
            const newYearlyStats = calculateYearlyStats(
              h.completions,
              updates.frequency || h.frequency,
              h.createdAt,
              updates.customDays || h.customDays
            );
            updatedHabit.yearlyStats = newYearlyStats;
          }
          return updatedHabit;
        }
        return h;
      }));
    };

    if (isAuthenticated) {
      try {
        const dbUpdates: any = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
        if (updates.customDays !== undefined) dbUpdates.customDays = updates.customDays;
        if (updates.archived !== undefined) dbUpdates.archived = updates.archived;
        if (updates.reminderTime !== undefined) dbUpdates.reminderTime = updates.reminderTime || undefined;
        if (updates.reminderEnabled !== undefined) dbUpdates.reminderEnabled = updates.reminderEnabled;

        const habit = habits.find(h => h.id === id);
        if (habit && (updates.frequency !== undefined || updates.customDays !== undefined)) {
          const newYearlyStats = calculateYearlyStats(
            habit.completions,
            updates.frequency || habit.frequency,
            habit.createdAt,
            updates.customDays || habit.customDays
          );
          dbUpdates.yearlyAchieved = newYearlyStats.achieved;
          dbUpdates.yearlyExpected = newYearlyStats.totalExpected;
          dbUpdates.statsYear = newYearlyStats.year;
        }

        await updateHabitMutation({
          id: id as Id<"habits">,
          ...dbUpdates
        });
      } catch (error: any) {
        console.error("Mutation failed, falling back to local:", error);
        if (error.message?.includes("Unauthorized") || error.toString().includes("Unauthorized")) {
          setForceLocal(true);
          handleLocalUpdate();
        } else {
          throw error;
        }
      }
    } else {
      handleLocalUpdate();
    }
  }, [updateHabitMutation, isAuthenticated, habits]);

  const deleteHabit = useCallback(async (id: string) => {
    if (isAuthenticated) {
      try {
        await deleteHabitMutation({ id: id as Id<"habits"> });
      } catch (error: any) {
        console.error("Mutation failed, falling back to local:", error);
        if (error.message?.includes("Unauthorized") || error.toString().includes("Unauthorized")) {
          setForceLocal(true);
          setLocalHabits(prev => prev.filter(h => h.id !== id));
        } else {
          throw error;
        }
      }
    } else {
      setLocalHabits(prev => prev.filter(h => h.id !== id));
    }
  }, [deleteHabitMutation, isAuthenticated]);

  return {
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    addHabitCompletion,
    // isInitialLoad is false if we have cached data (localStorage-first approach)
    isInitialLoad: isAuthenticated ? (rawHabits === undefined && cachedHabits === null && !initialHabits) : !isLocalLoaded,
  };
};
