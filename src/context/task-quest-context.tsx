"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useTasks } from '@/hooks/use-tasks';
import { useHabits } from '@/hooks/use-habits';
import { useWeblogs } from '@/hooks/use-weblogs';
import { useReminders } from '@/hooks/use-reminders';
import { useNotifications } from '@/hooks/use-notifications';
import { User, Task, Reminder, Project, Habit, Streaks } from '@/lib/types';
import { calculateLevel, XP_PER_NOTE, XP_PER_TASK } from '@/lib/level-system';
import { differenceInCalendarDays, isToday, isYesterday, parseISO, startOfDay } from 'date-fns';

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";

export interface InitialData {
  tasks?: Doc<"tasks">[];
  projects?: Doc<"projects">[];
  habits?: Doc<"habits">[];
  reminders?: Doc<"reminders">[];
}

interface TaskQuestContextType {
  // Auth & User
  isAuthenticated: boolean;
  authLoading: boolean;
  user: User | null;
  signOut: (callback?: () => void) => Promise<void>;

  // Data
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  reminders: Reminder[];

  // Stats & Streaks
  stats: {
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
  };
  streaks: Streaks;
  levelInfo: {
    level: number;
    totalXP: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progress: number;
  };

  // Actions - Tasks
  addTask: (taskData: Omit<Task, 'id' | 'isCompleted' | 'completedAt' | 'createdAt'>) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskCompletion: (taskId: string) => void;
  addSubtask: (taskId: string, text: string) => void;
  toggleSubtaskCompletion: (taskId: string, subtaskId: string) => Promise<'subtask' | 'main' | 'none'>;
  updateTask: (taskId: string, updatedData: Partial<Task>) => void;
  handleToggleTask: (taskId: string) => void;

  // Actions - Projects
  addProject: (projectData: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (projectId: string, data: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;

  // Actions - Habits
  addHabit: (habit: any) => void;
  updateHabit: (id: string, habit: any) => void;
  toggleHabitCompletion: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;

  // Actions - Reminders
  addReminder: (reminder: Omit<Reminder, 'id'>) => void;
  updateReminder: (id: string, reminder: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  toggleReminderActive: (id: string) => void;
  triggerReminder: (id: string) => void;

  // Notifications
  notificationState: {
    permission: NotificationPermission;
    isSupported: boolean;
    subscription: PushSubscription | null;
    subscribeToPush: () => Promise<void>;
    unsubscribeFromPush: () => Promise<void>;
  };

  // UI State
  isCelebrating: boolean;
  setCelebrating: (val: boolean) => void;
  windowSize: { width: number, height: number };
  taskToEdit: Task | null;
  setTaskToEdit: (task: Task | null) => void;
  reminderToEdit: Reminder | null;
  setReminderToEdit: (reminder: Reminder | null) => void;
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (val: boolean) => void;
  isInitialLoad: boolean;
}

const TaskQuestContext = createContext<TaskQuestContextType | null>(null);

export function TaskQuestProvider({ children, initialData }: { children: React.ReactNode, initialData?: InitialData }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut } = useClerk();
  const userData = useQuery(api.users.viewer);
  const updateSettingsMutation = useMutation(api.users.updateSettings);
  const autoCheckMilestonesMutation = useMutation(api.challenges.autoCheckMilestones);
  const recordDailyActivityMutation = useMutation(api.challenges.recordDailyActivity);
  const updateChallengeProgressMutation = useMutation(api.challenges.updateChallengeProgress);
  const storeUser = useMutation(api.users.store);
  const { toast } = useToast();

  // Store user on auth
  useEffect(() => {
    if (isAuthenticated) {
      storeUser().then((id) => {
        console.log("User stored/synced with ID:", id);
      }).catch((error) => {
        console.error("Failed to store user:", error);
        toast({
          title: "Authentication Sync Error",
          description: "Could not sync user data. Please try refreshing.",
          variant: "destructive"
        });
      });
    }
  }, [isAuthenticated, storeUser, toast]);

  const user: User | null = useMemo(() => {
    if (!userData) return null;
    return {
      id: userData._id,
      name: userData.name,
      email: userData.email,
      image: userData.image,
    };
  }, [userData]);

  // Hooks
  const {
    tasks,
    projects,
    stats,
    addTask,
    deleteTask,
    toggleTaskCompletion,
    addSubtask,
    toggleSubtaskCompletion,
    updateTask,
    addProject,
    updateProject,
    deleteProject,
    isInitialLoad,
  } = useTasks(initialData?.tasks, initialData?.projects);

  const {
    habits,
    addHabit,
    updateHabit,
    toggleHabitCompletion,
    deleteHabit,
  } = useHabits(initialData?.habits);

  const {
    reminders,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminderActive,
    triggerReminder,
  } = useReminders(initialData?.reminders);

  const { weblogs } = useWeblogs();

  const {
    permission,
    isSupported,
    subscription,
    subscribeToPush,
    unsubscribeFromPush
  } = useNotifications(tasks, habits, reminders, triggerReminder);

  // State
  const [isCelebrating, setCelebrating] = useState(false);
  const [windowSize, setWindowSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 });
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [reminderToEdit, setReminderToEdit] = useState<Reminder | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Calculate level info
  const levelInfo = useMemo(() => {
    const taskXP = tasks.reduce((acc, task) => {
      if (task.isCompleted) {
        return acc + (task.xp || XP_PER_TASK);
      }
      return acc;
    }, 0);

    const habitXP = habits.reduce((acc, habit) => {
      return acc + (habit.xp || 0);
    }, 0);

    const noteXP = weblogs.length * XP_PER_NOTE;

    return calculateLevel(taskXP + habitXP + noteXP);
  }, [tasks, habits, weblogs]);

  const streaks = useMemo<Streaks>(() => {
    const toStartOfDay = (value?: string) => {
      if (!value) return null;
      const parsedDate = parseISO(value);
      if (Number.isNaN(parsedDate.getTime())) return null;
      return startOfDay(parsedDate);
    };

    const taskCompletionDates = tasks
      .filter((task) => task.completedAt)
      .map((task) => toStartOfDay(task.completedAt || undefined))
      .filter((date): date is Date => date !== null);

    const weblogActivityDates = weblogs.flatMap((weblog) => {
      const activityDates: Date[] = [];
      const createdDate = toStartOfDay(weblog.createdAt);
      const updatedDate = toStartOfDay(weblog.updatedAt);
      if (createdDate) activityDates.push(createdDate);
      if (updatedDate) activityDates.push(updatedDate);
      return activityDates;
    });

    const uniqueDates = Array.from(
      new Set(
        [...taskCompletionDates, ...weblogActivityDates].map((date) => date.getTime())
      )
    )
      .map((time) => new Date(time))
      .sort((a, b) => a.getTime() - b.getTime());

    if (uniqueDates.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let currentRun = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const daysDiff = differenceInCalendarDays(uniqueDates[i], uniqueDates[i - 1]);
      if (daysDiff === 1) {
        currentRun++;
        continue;
      }

      if (daysDiff > 1) {
        longest = Math.max(longest, currentRun);
        currentRun = 1;
      }
    }

    longest = Math.max(longest, currentRun);

    let current = 0;
    const lastActiveDate = uniqueDates[uniqueDates.length - 1];

    if (isToday(lastActiveDate) || isYesterday(lastActiveDate)) {
      current = 1;
      for (let i = uniqueDates.length - 2; i >= 0; i--) {
        const daysDiff = differenceInCalendarDays(uniqueDates[i + 1], uniqueDates[i]);
        if (daysDiff === 1) {
          current++;
          continue;
        }
        if (daysDiff > 1) {
          break;
        }
      }
    }

    return { current, longest };
  }, [tasks, weblogs]);

  // Sync user settings to Convex
  useEffect(() => {
    if (user && !isInitialLoad && levelInfo) {
      const syncSettings = async () => {
        try {
          await updateSettingsMutation({
            totalXP: levelInfo.totalXP,
            level: levelInfo.level,
            currentStreak: streaks.current,
            longestStreak: streaks.longest,
            tasksCompleted: stats.completedTasks,
          });

          // Auto-check and create milestones based on current stats
          await autoCheckMilestonesMutation({
            tasksCompleted: stats.completedTasks,
            currentStreak: streaks.current,
            level: levelInfo.level,
          });

          // Record daily activity for friends to see
          const todaysHabitCompletions = habits.filter(h =>
            h.completions.some(c => {
              const completionDate = new Date(c.completedAt).toDateString();
              return completionDate === new Date().toDateString();
            })
          ).length;

          await recordDailyActivityMutation({
            tasksCompleted: stats.completedTasks,
            habitsCompleted: todaysHabitCompletions,
            xpEarned: levelInfo.totalXP,
            streakMaintained: streaks.current > 0,
          });

          // Update streak challenge progress if streak is active
          if (streaks.current > 0) {
            await updateChallengeProgressMutation({ type: "streak", value: streaks.current });
          }
        } catch (error) {
          console.error('Error syncing user settings:', error);
        }
      };

      const timer = setTimeout(syncSettings, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isInitialLoad, levelInfo.totalXP, levelInfo.level, streaks, stats.completedTasks, habits, updateSettingsMutation, autoCheckMilestonesMutation, recordDailyActivityMutation, updateChallengeProgressMutation]);

  // Window resize for confetti
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Confetti timeout
  useEffect(() => {
    if (isCelebrating) {
      const timer = setTimeout(() => setCelebrating(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isCelebrating]);

  const handleToggleTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.isCompleted) {
      toggleTaskCompletion(taskId);
      toast({
        title: "Quest Undone",
        description: "Quest moved back to active list.",
      });
    } else {
      toggleTaskCompletion(taskId);
    }
  }, [tasks, toggleTaskCompletion, toast]);

  // Derived auth loading state to prevent skeleton if initialData is present
  const derivedAuthLoading = initialData ? false : authLoading;

  return (
    <TaskQuestContext.Provider value={{
      isAuthenticated,
      authLoading: derivedAuthLoading,
      user,
      signOut,
      tasks,
      projects,
      habits,
      reminders,
      stats,
      streaks,
      levelInfo,
      addTask,
      deleteTask,
      toggleTaskCompletion,
      addSubtask,
      toggleSubtaskCompletion,
      updateTask,
      handleToggleTask,
      addProject,
      updateProject,
      deleteProject,
      addHabit,
      updateHabit,
      toggleHabitCompletion,
      deleteHabit,
      addReminder,
      updateReminder,
      deleteReminder,
      toggleReminderActive,
      triggerReminder,
      notificationState: {
        permission,
        isSupported,
        subscription,
        subscribeToPush,
        unsubscribeFromPush
      },
      isCelebrating,
      setCelebrating,
      windowSize,
      taskToEdit,
      setTaskToEdit,
      reminderToEdit,
      setReminderToEdit,
      isQuickAddOpen,
      setIsQuickAddOpen,
      isInitialLoad
    }}>
      {children}
    </TaskQuestContext.Provider>
  );
}

export function useTaskQuest() {
  const context = useContext(TaskQuestContext);
  if (!context) {
    throw new Error("useTaskQuest must be used within a TaskQuestProvider");
  }
  return context;
}
