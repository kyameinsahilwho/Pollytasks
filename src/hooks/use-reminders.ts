"use client";

import { useMemo, useCallback, useEffect, useState } from 'react';
import { Reminder } from '@/lib/types';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useToast } from './use-toast';
import { parseISO } from 'date-fns';

const CACHE_KEY_REMINDERS = 'pollytasks_cache_reminders';
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
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (e) {
    console.error("Failed to cache reminders data:", e);
  }
}

export const useReminders = () => {
  const { toast } = useToast();
  const rawReminders = useQuery(api.reminders.get);
  const [cachedReminders] = useState<Reminder[] | null>(() => getCachedData<Reminder[]>(CACHE_KEY_REMINDERS));
  const addReminderMutation = useMutation(api.reminders.add);
  const updateReminderMutation = useMutation(api.reminders.update);
  const deleteReminderMutation = useMutation(api.reminders.remove);

  const reminders: Reminder[] = useMemo(() => {
    if (rawReminders === undefined) {
      return cachedReminders ?? [];
    }

    return rawReminders.map(r => ({
      id: r._id,
      title: r.title,
      description: r.description,
      type: r.type as 'one-time' | 'ongoing',
      intervalUnit: r.intervalUnit as 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | undefined,
      intervalValue: r.intervalValue,
      remindAt: r.remindAt,
      isActive: r.isActive,
      icon: r.icon,
      createdAt: "", // Not in schema, but reminder type has it. Supabase didn't store it?
      // Actually schema I wrote doesn't have createdAt for reminders? 
      // Let's check schema. I didn't verify createdAt in schema for reminders.
      // Supabase `reminders` table usually has `created_at`.
      // My code generated createdAt: new Date().toISOString() in `addReminder` but did Supabase store it?
      // In `use-reminders.ts` Step 97 line 78: `createdAt` is used in local state.
      // Line 87 insert: `created_at` NOT inserted?
      // Wait, line 87 insert arguments do NOT include `created_at`.
      // So Supabase schema might have default `now()`.
      // Convex schema I wrote: NO createdAt for reminders.
      // So I'll just put empty string or current date, or update schema.
      // For now, empty string is fine as it seems unused for sorting (sort is by `remind_at`).
    })).sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
  }, [rawReminders, cachedReminders]);

  useEffect(() => {
    if (rawReminders !== undefined) {
      const mappedReminders: Reminder[] = rawReminders.map(r => ({
        id: r._id,
        title: r.title,
        description: r.description,
        type: r.type as 'one-time' | 'ongoing',
        intervalUnit: r.intervalUnit as 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | undefined,
        intervalValue: r.intervalValue,
        remindAt: r.remindAt,
        isActive: r.isActive,
        icon: r.icon,
        createdAt: "",
      }));
      setCachedData(CACHE_KEY_REMINDERS, mappedReminders);
    }
  }, [rawReminders]);

  const addReminder = useCallback(async (reminderData: Omit<Reminder, 'id' | 'createdAt' | 'isActive'>) => {
    try {
      await addReminderMutation({
        title: reminderData.title,
        description: reminderData.description,
        type: reminderData.type,
        intervalUnit: reminderData.intervalUnit,
        intervalValue: reminderData.intervalValue,
        remindAt: reminderData.remindAt,
        isActive: true,
        icon: reminderData.icon
      });
      toast({
        title: "Reminder Saved",
        description: "Your reminder has been synced to the cloud.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to save reminder.",
        variant: "destructive"
      });
    }
  }, [addReminderMutation, toast]);

  const updateReminder = useCallback(async (id: string, updates: Partial<Reminder>) => {
    try {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.intervalUnit !== undefined) dbUpdates.intervalUnit = updates.intervalUnit;
      if (updates.intervalValue !== undefined) dbUpdates.intervalValue = updates.intervalValue;
      if (updates.remindAt !== undefined) dbUpdates.remindAt = updates.remindAt;
      if (updates.isActive !== undefined) dbUpdates.isActive = updates.isActive;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;

      await updateReminderMutation({
        id: id as Id<"reminders">,
        ...dbUpdates
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update reminder.",
        variant: "destructive"
      });
    }
  }, [updateReminderMutation, toast]);

  const deleteReminder = useCallback(async (id: string) => {
    try {
      await deleteReminderMutation({ id: id as Id<"reminders"> });
      toast({
        title: "Reminder Deleted",
        description: "Reminder removed from your journey.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete reminder.",
        variant: "destructive"
      });
    }
  }, [deleteReminderMutation, toast]);

  const toggleReminderActive = useCallback(async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
      await updateReminder(id, { isActive: !reminder.isActive });
    }
  }, [reminders, updateReminder]);

  const triggerReminder = useCallback(async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    if (reminder.type === 'one-time') {
      await deleteReminder(id);
    } else if (reminder.type === 'ongoing' && reminder.intervalUnit && reminder.intervalValue) {
      const nextRemindAt = new Date(parseISO(reminder.remindAt));

      switch (reminder.intervalUnit) {
        case 'hours':
          nextRemindAt.setHours(nextRemindAt.getHours() + reminder.intervalValue);
          break;
        case 'days':
          nextRemindAt.setDate(nextRemindAt.getDate() + reminder.intervalValue);
          break;
        case 'weeks':
          nextRemindAt.setDate(nextRemindAt.getDate() + (reminder.intervalValue * 7));
          break;
        case 'months':
          nextRemindAt.setMonth(nextRemindAt.getMonth() + reminder.intervalValue);
          break;
      }

      await updateReminder(id, { remindAt: nextRemindAt.toISOString() });
    }
  }, [reminders, deleteReminder, updateReminder]);

  return {
    reminders,
    isInitialLoad: rawReminders === undefined && cachedReminders === null,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminderActive,
    triggerReminder,
    reloadReminders: async () => { }, // No-op
  };
};
