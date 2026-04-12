"use client";

import { useMemo, useRef, useState } from "react";
import { Habit } from "@/lib/types";
import { Button } from "./ui/button";
import { ArrowLeft, Trophy, Flame, Target, Calendar as CalendarIcon, CheckCircle2, CircleDashed, ChevronLeft, ChevronRight, Share2, Download } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { parseISO, startOfDay, isSameWeek, isSameMonth, subDays, startOfWeek, startOfMonth, eachDayOfInterval, startOfYear, endOfYear, isSameDay, eachWeekOfInterval, eachMonthOfInterval, differenceInCalendarDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

interface RitualStatsProps {
  habit: Habit;
  onBack: () => void;
}

export function RitualStats({ habit, onBack }: RitualStatsProps) {
  const { toast } = useToast();
  const statsRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Calculate stats
  const completionDates = useMemo(() => 
    habit.completions.map(c => startOfDay(parseISO(c.completedAt))),
    [habit.completions]
  );
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const creationYear = useMemo(() => {
    return habit.createdAt ? parseISO(habit.createdAt).getFullYear() : new Date().getFullYear();
  }, [habit.createdAt]);

  const getTotalCompletions = () => habit.totalCompletions ?? habit.completions.length;

  const yearlyStats = useMemo(() => {
    if (selectedYear === new Date().getFullYear() && habit.yearlyStats && habit.yearlyStats.year === new Date().getFullYear()) {
      return habit.yearlyStats;
    }
    
    // Fallback calculation if not stored or wrong year
    const start = startOfYear(new Date(selectedYear, 0, 1));
    const end = endOfYear(new Date(selectedYear, 0, 1));
    
    let totalExpected = 0;
    let achieved = 0;

    const completionDateTimes = new Set(completionDates.map(d => d.getTime()));

    if (habit.frequency === 'daily' || habit.frequency === 'specific_days' || ['every_2_days', 'every_3_days', 'every_4_days'].includes(habit.frequency)) {
      const days = eachDayOfInterval({ start, end });
      const creationDate = startOfDay(parseISO(habit.createdAt));

      days.forEach(day => {
        let isScheduled = true;
        
        if (day < creationDate) {
          isScheduled = false;
        } else if (habit.frequency === 'specific_days') {
          isScheduled = habit.customDays?.includes(day.getDay()) ?? false;
        } else if (['every_2_days', 'every_3_days', 'every_4_days'].includes(habit.frequency)) {
          const interval = parseInt(habit.frequency.split('_')[1]);
          const diffDays = differenceInCalendarDays(startOfDay(day), creationDate);
          isScheduled = diffDays >= 0 && diffDays % interval === 0;
        }
        
        if (isScheduled) {
          totalExpected++;
          if (completionDateTimes.has(day.getTime())) {
            achieved++;
          }
        }
      });
    } else if (habit.frequency === 'weekly') {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });
      totalExpected = weeks.length;
      weeks.forEach(week => {
        if (habit.completions.some(c => isSameWeek(parseISO(c.completedAt), week, { weekStartsOn: 0 }))) {
          achieved++;
        }
      });
    } else if (habit.frequency === 'monthly') {
      const months = eachMonthOfInterval({ start, end });
      totalExpected = months.length;
      months.forEach(month => {
        if (habit.completions.some(c => isSameMonth(parseISO(c.completedAt), month))) {
          achieved++;
        }
      });
    }

    return { achieved, totalExpected };
  }, [habit, completionDates, selectedYear]);

  const getHabitAccentColorHex = (colorStr?: string) => {
    // Duolingo Blue as default
    if (!colorStr) return "hsl(199, 92%, 54%)";
    if (colorStr.includes("blue")) return "hsl(217, 91%, 60%)";
    if (colorStr.includes("purple")) return "hsl(271, 91%, 65%)";
    if (colorStr.includes("cyan")) return "hsl(188, 86%, 53%)";
    if (colorStr.includes("rose")) return "hsl(341, 81%, 62%)";
    if (colorStr.includes("amber")) return "hsl(38, 92%, 50%)";
    if (colorStr.includes("indigo")) return "hsl(239, 84%, 67%)";
    if (colorStr.includes("emerald")) return "hsl(160, 84%, 39%)";
    if (colorStr.includes("orange")) return "hsl(24, 94%, 50%)";
    if (colorStr.includes("pink")) return "hsl(327, 73%, 58%)";
    if (colorStr.includes("violet")) return "hsl(258, 90%, 66%)";
    if (colorStr.includes("teal")) return "hsl(173, 80%, 40%)";
    if (colorStr.includes("sky")) return "hsl(199, 89%, 48%)";
    if (colorStr.includes("lime")) return "hsl(84, 81%, 44%)";
    if (colorStr.includes("yellow")) return "hsl(45, 93%, 47%)";
    if (colorStr.includes("fuchsia")) return "hsl(292, 91%, 50%)";
    if (colorStr.includes("slate")) return "hsl(215, 25%, 27%)";
    return "hsl(199, 92%, 54%)";
  };

  const accentColor = getHabitAccentColorHex(habit.color);

  const modifiers = {
    completed: completionDates
  };
  
  const modifiersStyles = {
    completed: {
      backgroundColor: accentColor,
      color: "white",
      fontWeight: "bold",
      borderRadius: "50%"
    }
  };

  const handleShare = async () => {
    if (!statsRef.current) return;
    setIsSharing(true);

    try {
      const canvas = await html2canvas(statsRef.current, {
        scale: 2, // Higher quality
        backgroundColor: "#ffffff",
        ignoreElements: (element) => element.getAttribute("data-html2canvas-ignore") === "true"
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsSharing(false);
          return;
        }

        const file = new File([blob], `taskquest-stats-${habit.title.toLowerCase().replace(/\s+/g, '-')}.png`, {
          type: "image/png",
        });

        // Try using Web Share API with file support
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "TaskQuest Stats",
              text: `Check out my progress on ${habit.title}! #TaskQuest`,
            });
            toast({
              title: "Shared successfully!",
              description: "Your stats have been shared.",
            });
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              console.error("Error sharing:", error);
              // Fallback to download
              downloadImage(blob);
            }
          }
        } else {
          // Fallback for browsers that don't support file sharing
          downloadImage(blob);
        }
        setIsSharing(false);
      }, "image/png");
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Error",
        description: "Failed to generate stats image.",
        variant: "destructive",
      });
      setIsSharing(false);
    }
  };

  const downloadImage = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskquest-stats-${habit.title.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Image downloaded!",
      description: "Stats image saved to your device.",
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-24 animate-in fade-in slide-in-from-right duration-300">
      {/* Header - Not Captured in Share */}
      <div className="flex items-center justify-between" data-html2canvas-ignore="true">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-12 h-12 rounded-2xl border-2 border-b-4 border-[#E2E8F0] hover:bg-[#F1F4F9] text-[#1E293B] active:border-b-0 active:translate-y-1 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h2 className="text-3xl font-black text-[#1E293B] uppercase tracking-tight flex items-center gap-3">
              <span className="text-4xl">{habit.icon || <CircleDashed className="w-10 h-10 text-gray-300" />}</span>
              {habit.title}
            </h2>
            <p className="text-[#64748B]/60 font-black uppercase tracking-[0.2em] text-xs">Ritual Statistics</p>
          </div>
        </div>
      </div>

      {/* Stats Container to Capture */}
      <div ref={statsRef} className="flex flex-col gap-8 p-4 bg-white/50 rounded-[3rem]">
        {/* Title for Shared Image (Visible only in capture if needed, or we can just capture the existing structure) */}
        {/* We reuse the header structure but make it visible inside capture area if we want the title in the image */}
        <div className="flex items-center justify-center pb-4 border-b-2 border-dashed border-gray-200">
             <h2 className="text-3xl font-black text-[#1E293B] uppercase tracking-tight flex items-center gap-3">
              <span className="text-4xl">{habit.icon || <CircleDashed className="w-10 h-10 text-gray-300" />}</span>
              {habit.title}
            </h2>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Streak/Frequency Cards */}
        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-6 rounded-[2rem] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-3 text-orange-500">
            <Flame className="w-6 h-6 fill-orange-500" />
            <span className="text-xs font-black uppercase tracking-widest">
              Current Streak
            </span>
          </div>
          <div className="text-5xl font-black text-[#1E293B]">
            {habit.currentStreak}
            <span className="text-xl text-gray-300 uppercase ml-2">
              Days
            </span>
          </div>
        </div>

        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-6 rounded-[2rem] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-3 text-yellow-500">
            <Trophy className="w-6 h-6 fill-yellow-500" />
            <span className="text-xs font-black uppercase tracking-widest">
              Best Streak
            </span>
          </div>
          <div className="text-5xl font-black text-[#1E293B]">
            {habit.bestStreak}
            <span className="text-xl text-gray-300 uppercase ml-2">
              Days
            </span>
          </div>
        </div>

        

        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-6 rounded-[2rem] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-3 text-[#1E293B]">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-widest">Total Achieved</span>
          </div>
          <div className="text-5xl font-black text-[#1E293B]">
            {getTotalCompletions()}
            <span className="text-xl text-gray-300 uppercase ml-2">Times</span>
          </div>
        </div>

        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-6 rounded-[2rem] flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-3 text-blue-500">
            <Target className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-widest">Yearly Progress</span>
          </div>
          <div className="text-5xl font-black text-[#1E293B]">
            {yearlyStats.achieved}
            <span className="text-xl text-gray-300 uppercase mx-1">/</span>
            <span className="text-3xl text-gray-400">{yearlyStats.totalExpected}</span>
          </div>
        </div>

        
      </div>

      {/* Grid Section */}
      {habit.frequency === 'daily' || habit.frequency === 'specific_days' || ['every_2_days', 'every_3_days', 'every_4_days'].includes(habit.frequency) ? (
        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-8 rounded-[3rem] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-[#1E293B] uppercase tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F4F9] border-2 border-b-4 border-[#E2E8F0] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#1E293B]" />
              </div>
              Yearly Progress
            </h3>
            <div className="flex items-center gap-2 bg-[#F1F4F9] p-1 rounded-xl border-2 border-[#E2E8F0]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                onClick={() => setSelectedYear(y => Math.max(creationYear, y - 1))}
                disabled={selectedYear <= creationYear}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-black text-[#1E293B] min-w-[3rem] text-center">
                {selectedYear}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                onClick={() => setSelectedYear(y => Math.min(new Date().getFullYear(), y + 1))}
                disabled={selectedYear >= new Date().getFullYear()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {eachDayOfInterval({ start: startOfYear(new Date(selectedYear, 0, 1)), end: endOfYear(new Date(selectedYear, 0, 1)) }).map((day, i) => {
              const isCompleted = completionDates.some(d => isSameDay(d, day));
              const isCurrentDay = isSameDay(day, new Date());
              let isScheduled = true;
              
              if (day < startOfDay(parseISO(habit.createdAt))) {
                isScheduled = false;
              } else if (habit.frequency === 'specific_days') {
                isScheduled = habit.customDays?.includes(day.getDay()) ?? false;
              } else if (['every_2_days', 'every_3_days', 'every_4_days'].includes(habit.frequency)) {
                const interval = parseInt(habit.frequency.split('_')[1]);
                const startDate = startOfDay(parseISO(habit.createdAt));
                const diffDays = differenceInCalendarDays(startOfDay(day), startDate);
                isScheduled = diffDays >= 0 && diffDays % interval === 0;
              }

              return isCurrentDay ? (
                <div key={i} className="relative flex-shrink-0 w-2.5 h-2.5">
                  <div className={cn(
                    "absolute inset-0 rounded-[2px] animate-ping",
                    isCompleted ? "bg-[#58cc02]/40" : "bg-emerald-400/25"
                  )} style={{ animationDuration: '2s' }} />
                  <div
                    title={format(day, 'MMM d, yyyy')}
                    className={cn(
                      "relative w-full h-full rounded-[2px]",
                      isCompleted ? "bg-[#58cc02]" : "bg-emerald-100 border border-emerald-300/60"
                    )}
                  />
                </div>
              ) : (
                <div
                  key={i}
                  title={format(day, 'MMM d, yyyy')}
                  className={cn(
                    "w-2.5 h-2.5 rounded-[2px] transition-colors duration-200",
                    isCompleted
                      ? "bg-[#58cc02] shadow-[0_0_5px_rgba(88,204,2,0.3)]"
                      : isScheduled
                        ? "bg-[#F1F4F9] border border-[#E2E8F0]"
                        : "bg-gray-100/20"
                  )}
                />
              );

            })}
          </div>
        </div>
      ) : habit.frequency === 'weekly' ? (
        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-8 rounded-[3rem] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-[#1E293B] uppercase tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F4F9] border-2 border-b-4 border-[#E2E8F0] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#1E293B]" />
              </div>
              Weekly Progress
            </h3>
            <div className="flex items-center gap-2 bg-[#F1F4F9] p-1 rounded-xl border-2 border-[#E2E8F0]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                onClick={() => setSelectedYear(y => Math.max(creationYear, y - 1))}
                disabled={selectedYear <= creationYear}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-black text-[#1E293B] min-w-[3rem] text-center">
                {selectedYear}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                onClick={() => setSelectedYear(y => Math.min(new Date().getFullYear(), y + 1))}
                disabled={selectedYear >= new Date().getFullYear()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {eachWeekOfInterval({ start: startOfYear(new Date(selectedYear, 0, 1)), end: endOfYear(new Date(selectedYear, 0, 1)) }, { weekStartsOn: 0 }).map((week, i) => {
              const isCompleted = habit.completions.some(c => isSameWeek(parseISO(c.completedAt), week, { weekStartsOn: 0 }));
              return (
                <div
                  key={i}
                  title={`Week of ${format(week, 'MMM d')}`}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all duration-200 border-2",
                    isCompleted 
                      ? "bg-[#58cc02] border-[#46a302] text-white shadow-md" 
                      : "bg-[#F1F4F9] border-[#E2E8F0] text-gray-300"
                  )}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
      ) : habit.frequency === 'monthly' ? (
        <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-8 rounded-[3rem] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-[#1E293B] uppercase tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F4F9] border-2 border-b-4 border-[#E2E8F0] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#1E293B]" />
              </div>
              Monthly Progress
            </h3>
            <div className="flex items-center gap-2 bg-[#F1F4F9] p-1 rounded-xl border-2 border-[#E2E8F0]">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                onClick={() => setSelectedYear(y => Math.max(creationYear, y - 1))}
                disabled={selectedYear <= creationYear}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-black text-[#1E293B] min-w-[3rem] text-center">
                {selectedYear}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                onClick={() => setSelectedYear(y => Math.min(new Date().getFullYear(), y + 1))}
                disabled={selectedYear >= new Date().getFullYear()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {eachMonthOfInterval({ start: startOfYear(new Date(selectedYear, 0, 1)), end: endOfYear(new Date(selectedYear, 0, 1)) }).map((month, i) => {
              const isCompleted = habit.completions.some(c => isSameMonth(parseISO(c.completedAt), month));
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
                    isCompleted 
                      ? "bg-[#58cc02] border-[#46a302] text-white shadow-md" 
                      : "bg-[#F1F4F9] border-[#E2E8F0] text-gray-400"
                  )}
                >
                  <span className="text-xs font-black uppercase tracking-widest">{format(month, 'MMM')}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Calendar Section */}
      <div className="bg-white border-2 border-b-8 border-[#E2E8F0] p-8 rounded-[3rem] shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black text-[#1E293B] uppercase tracking-tight flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F1F4F9] border-2 border-b-4 border-[#E2E8F0] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4 text-[#1E293B]" />
            </div>
            Completion History
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-md bg-[#F1F4F9] border border-[#E2E8F0]" />
              <span className="text-xs font-bold text-gray-400">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-md bg-[#1E293B] border border-[#0F172A] shadow-sm" />
              <span className="text-xs font-bold text-gray-400">Achieved</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center p-4 bg-[#F1F4F9]/30 rounded-3xl border-2 border-b-4 border-[#F1F4F9]">
          <Calendar
            mode="multiple"
            selected={completionDates}
            className="rounded-md border-none"
            classNames={{
              day_today: "bg-[#F1F4F9] text-[#1E293B] font-black rounded-full border-2 border-[#E2E8F0]",
              day_selected: "rounded-full border-2 shadow-sm opacity-100 hover:opacity-100",
              head_cell: "text-[#64748B]/60 font-black uppercase tracking-widest text-[10px]",
              nav_button: "border-2 border-b-4 border-[#E2E8F0] hover:bg-[#F1F4F9] text-[#1E293B] rounded-xl transition-all",
              cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent",
            }}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
        </div>
      </div>

      </div>

      {/* Share Button - Not Captured */}
      <div className="flex justify-center pt-4" data-html2canvas-ignore="true">
        <Button
          size="lg"
          onClick={handleShare}
          disabled={isSharing}
          className="w-full sm:w-auto min-w-[240px] h-16 text-lg font-black uppercase tracking-wider gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 border-b-[6px] border-blue-700 hover:border-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSharing ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            <>
              <Share2 className="w-6 h-6" />
              Share Stats Image
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
