"use client";

import { Suspense, lazy, useRef, useEffect, useState } from 'react';
import Header from '@/components/header';
import { useTaskQuest } from '@/context/task-quest-context';
import { QuickAddMenu } from '@/components/quick-add-menu';
import { EditTaskDialog } from '@/components/edit-task-dialog';
import { EditReminderDialog } from '@/components/edit-reminder-dialog';
import { CalendarDialog } from '@/components/calendar-dialog';
import { usePathname } from 'next/navigation';

// Layout components
import { DesktopSidebar, MobileBottomNav, LoadingSkeleton } from '@/components/layout';

// Lazy load Confetti for better initial load performance
const Confetti = lazy(() => import('react-confetti'));

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated,
    user,
    signOut,
    stats,
    streaks,
    levelInfo,
    tasks,
    habits,
    projects,
    toggleTaskCompletion,
    toggleHabitCompletion,
    isInitialLoad,
    notificationState,
    isCelebrating,
    windowSize,
    taskToEdit,
    setTaskToEdit,
    updateTask,
    reminderToEdit,
    setReminderToEdit,
    updateReminder,
    isQuickAddOpen,
    setIsQuickAddOpen,
    addTask,
    addHabit,
    addProject
  } = useTaskQuest();

  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasRenderedContent, setHasRenderedContent] = useState(false);

  useEffect(() => {
    if (!isInitialLoad) {
      setHasRenderedContent(true);
    }
  }, [isInitialLoad]);

  const showInitialSkeleton = !hasRenderedContent && isInitialLoad;

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [pathname]);

  const getTitle = () => {
    // Check if we are in a project detail page (if we implement sub-routing for projects later)
    // For now, simple matching
    if (pathname === '/' || pathname === '/today') return 'Quests';
    if (pathname?.startsWith('/habits')) return 'Rituals';
    if (pathname?.startsWith('/projects')) return 'Projects';
    if (pathname?.startsWith('/social')) return 'Squad';
    if (pathname?.startsWith('/weblog')) return 'Weblog';
    if (pathname?.startsWith('/profile')) return 'Profile';
    if (pathname?.startsWith('/archive')) return 'Archive';
    return 'Quests';
  };

  // We no longer use an early return for loading state
  // The layout shell (sidebar, header, nav) always renders immediately
  // Only the content area shows a loading skeleton when isInitialLoad or authLoading

  return (
    <div className="flex h-[100dvh] w-full font-body transition-colors duration-500 bg-background overflow-hidden">
      {isCelebrating && (
        <Suspense fallback={null}>
          <Confetti width={windowSize.width} height={windowSize.height} recycle={false} />
        </Suspense>
      )}

      {/* Desktop Sidebar */}
      <DesktopSidebar
        levelInfo={levelInfo}
        completionPercentage={stats.completionPercentage}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header
          stats={{ ...stats, levelInfo }}
          streaks={streaks}
          isInitialLoad={showInitialSkeleton}
          user={user}
          onSignOut={() => signOut()}
          isSyncing={false}
          isAuthenticated={isAuthenticated}
          notificationState={notificationState}
        />

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 pb-32 md:p-8">
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
            {/* Page Title & Actions */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl md:text-4xl font-black text-foreground uppercase tracking-tight">
                {getTitle()}
              </h1>
              <CalendarDialog
                tasks={tasks}
                habits={habits}
                onToggleTask={toggleTaskCompletion}
                onToggleHabit={toggleHabitCompletion}
              >
                <button className="bg-card hover:bg-muted/50 border-2 border-border text-foreground font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl shadow-3d active:shadow-none active:translate-y-1 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                  Calendar
                </button>
              </CalendarDialog>
            </div>

            {/* Page Content - Show skeleton only in content area when loading */}
            <div className="min-h-[400px]">
              {showInitialSkeleton ? (
                <LoadingSkeleton />
              ) : (
                children
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Menu (FAB) */}
        <QuickAddMenu
          projects={projects}
          selectedProjectId={null}
          onAddTask={addTask}
          onAddHabit={addHabit}
          onAddProject={addProject}
          isOpen={isQuickAddOpen}
          onOpenChange={setIsQuickAddOpen}
        />
      </main>

      {/* Mobile Navigation */}
      <MobileBottomNav
        activeTab={pathname === '/' ? 'today' : pathname.replace('/', '')}
        isQuickAddOpen={isQuickAddOpen}
        onToggleQuickAdd={() => setIsQuickAddOpen(!isQuickAddOpen)}
        onTabChange={() => { }}
      />

      {/* Dialogs */}
      {taskToEdit && (
        <EditTaskDialog
          isOpen={!!taskToEdit}
          onClose={() => setTaskToEdit(null)}
          onEditTask={(updated) => {
            updateTask(taskToEdit.id, updated);
            setTaskToEdit(null);
          }}
          task={taskToEdit}
          projects={projects}
        />
      )}
      {reminderToEdit && (
        <EditReminderDialog
          isOpen={!!reminderToEdit}
          onClose={() => setReminderToEdit(null)}
          onEditReminder={(id, updated) => {
            updateReminder(id, updated);
            setReminderToEdit(null);
          }}
          reminder={reminderToEdit}
        />
      )}
    </div>
  );
}
