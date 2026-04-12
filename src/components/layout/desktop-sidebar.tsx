"use client";

import Image from 'next/image';
import { HeroStatsCard } from './hero-stats-card';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DesktopSidebarProps {
    levelInfo: {
        level: number;
        currentLevelXP: number;
        nextLevelXP: number;
        progress: number;
    };
    completionPercentage: number;
}

export function DesktopSidebar({
    levelInfo,
    completionPercentage
}: DesktopSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/' || path === '/today') {
            return pathname === '/' || pathname === '/today';
        }
        return pathname.startsWith(path);
    };

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 320 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "flex-col h-full shrink-0 overflow-y-auto z-20 hidden lg:flex border-r border-border/50 bg-background/50 backdrop-blur-xl",
                isCollapsed ? "p-3 items-center" : "p-6"
            )}
        >
            {/* Header + Toggle */}
            <div className={cn("mb-8 flex items-center transition-all", isCollapsed ? "flex-col gap-4 justify-center" : "justify-between px-2")}>
                <div className={cn("flex items-center gap-4", isCollapsed && "flex-col")}>
                    <Image
                        src="/favicon.ico"
                        alt="Logo"
                        width={48}
                        height={48}
                        className={cn(
                            "object-contain drop-shadow-sm transition-all duration-300",
                            isCollapsed ? "w-10 h-10" : "w-12 h-12"
                        )}
                        quality={100}
                    />
                    {!isCollapsed && (
                        <motion.h1
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="text-xl font-black tracking-tight text-foreground whitespace-nowrap"
                        >
                            Pollytasks
                        </motion.h1>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            <div className="flex flex-col gap-6 h-full w-full">
                {/* Navigation */}
                <div className="flex flex-col gap-3 w-full">
                    {!isCollapsed && (
                        <motion.h3
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-1 pl-4"
                        >
                            Navigation
                        </motion.h3>
                    )}

                    <div className={cn("flex flex-col h-auto bg-transparent border-0 p-0 gap-2 w-full", isCollapsed && "items-center")}>
                        <SidebarItem
                            href="/"
                            isActive={isActive('/')}
                            icon="swords"
                            label="Today"
                            color="green"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarItem
                            href="/notes"
                            isActive={isActive('/notes')}
                            icon="menu_book"
                            label="Notes"
                            color="amber"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarItem
                            href="/projects"
                            isActive={isActive('/projects')}
                            icon="folder_open"
                            label="Projects"
                            color="orange"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarItem
                            href="/social"
                            isActive={isActive('/social')}
                            icon="group"
                            label="Squad"
                            color="purple"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarItem
                            href="/profile"
                            isActive={isActive('/profile')}
                            icon="person"
                            label="Profile"
                            color="pink"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarItem
                            href="/archive"
                            isActive={isActive('/archive')}
                            icon="inventory_2"
                            label="Archive"
                            color="slate"
                            isCollapsed={isCollapsed}
                        />
                    </div>
                </div>

                {/* Hero Stats */}
                <div className="mt-auto w-full">
                    {isCollapsed ? (
                        <div className="flex justify-center w-full py-4 relative group">
                            <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center border-2 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 font-black text-sm">
                                {levelInfo.level}
                            </div>
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50 bg-background rounded-2xl shadow-xl border-2 border-border p-0 overflow-hidden transform scale-95 group-hover:scale-100 origin-left">
                                <HeroStatsCard levelInfo={levelInfo} completionPercentage={completionPercentage} />
                            </div>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <HeroStatsCard levelInfo={levelInfo} completionPercentage={completionPercentage} />
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.aside>
    );
}

interface SidebarItemProps {
    href: string;
    isActive: boolean;
    icon: string;
    label: string;
    color: string;
    isCollapsed: boolean;
}

function SidebarItem({ href, isActive, icon, label, color, isCollapsed }: SidebarItemProps) {
    const accentTextColors: Record<string, string> = {
        green: isActive ? "text-green-600 dark:text-green-400" : "",
        blue: isActive ? "text-blue-600 dark:text-blue-400" : "",
        orange: isActive ? "text-amber-700 dark:text-amber-500" : "",
        amber: isActive ? "text-amber-600 dark:text-amber-400" : "",
        purple: isActive ? "text-purple-600 dark:text-purple-400" : "",
        pink: isActive ? "text-pink-600 dark:text-pink-400" : "",
        slate: isActive ? "text-slate-700 dark:text-slate-300" : ""
    };

    return (
        <Link
            href={href}
            className={cn(
                "sidebar-item flex items-center rounded-2xl w-full mb-1 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground border border-transparent transition-all duration-150 group relative overflow-hidden",
                isActive ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 font-black" : "",
                isCollapsed ? "justify-center px-0 py-2.5 w-10 h-10 mx-auto" : "justify-start gap-3 px-3 py-2.5",
                accentTextColors[color]
            )}
        >
            <div className={cn("z-10 flex items-center justify-center transition-all", isCollapsed ? "" : "")}>
                <span className={`material-symbols-outlined text-2xl ${isActive ? "[font-variation-settings:'FILL'_1]" : ""}`}>
                    {icon}
                </span>
            </div>
            {!isCollapsed && (
                <span className="text-xs font-bold uppercase tracking-wide z-10 whitespace-nowrap">
                    {label}
                </span>
            )}
        </Link>
    );
}
