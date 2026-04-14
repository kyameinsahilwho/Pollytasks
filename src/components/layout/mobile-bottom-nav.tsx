"use client";

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileBottomNavProps {
    activeTab?: string; // Optional or ignored
    isQuickAddOpen: boolean;
    onToggleQuickAdd: () => void;
    onTabChange?: (tab: string) => void; // Optional or ignored
}

export function MobileBottomNav({
    isQuickAddOpen,
    onToggleQuickAdd
}: MobileBottomNavProps) {
    const pathname = usePathname();
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Helper to check active state
    const isActive = (path: string) => {
        if (path === '/' || path === '/today') {
            return pathname === '/' || pathname === '/today';
        }
        return pathname.startsWith(path);
    };

    const isMoreActive = isActive('/projects') || isActive('/archive') || isActive('/profile');

    return (
        <>
            {/* More Menu Overlay */}
            <AnimatePresence>
                {showMoreMenu && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="lg:hidden fixed inset-0 bg-black/40 z-40"
                            onClick={() => setShowMoreMenu(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="lg:hidden fixed bottom-24 right-4 z-50 bg-card rounded-2xl border-2 border-border shadow-2xl overflow-hidden min-w-[160px]"
                        >
                            <Link
                                href="/projects"
                                onClick={() => setShowMoreMenu(false)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none border-b border-border/50 ${isActive('/projects')
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-500'
                                    : 'text-muted-foreground'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-xl ${isActive('/projects') ? "[font-variation-settings:'FILL'_1]" : ""}`}>folder_open</span>
                                <span className="font-bold text-sm">Projects</span>
                            </Link>
                            <Link
                                href="/profile"
                                onClick={() => setShowMoreMenu(false)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none border-b border-border/50 ${isActive('/profile')
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400'
                                    : 'text-muted-foreground'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-xl ${isActive('/profile') ? "[font-variation-settings:'FILL'_1]" : ""}`}>person</span>
                                <span className="font-bold text-sm">Profile</span>
                            </Link>
                            <Link
                                href="/archive"
                                onClick={() => setShowMoreMenu(false)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none ${isActive('/archive')
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400'
                                    : 'text-muted-foreground'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-xl ${isActive('/archive') ? "[font-variation-settings:'FILL'_1]" : ""}`}>inventory_2</span>
                                <span className="font-bold text-sm">Archive</span>
                            </Link>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 bg-card/95 border-t-2 border-border backdrop-blur-md pb-safe">
                <div className="flex flex-col">
                    <div className="grid w-full grid-cols-5 p-2 h-auto bg-transparent border-0 rounded-none gap-1 relative">
                        <Link
                            href="/"
                            className={`relative rounded-xl flex items-center justify-center transition-all font-bold py-3 h-auto group transform transition-transform duration-75 ${isActive('/')
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-green-600 dark:text-green-400 shadow-none'
                                : 'bg-transparent text-muted-foreground'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-2xl relative z-10 transition-transform duration-75 group-active:scale-90 ${isActive('/') ? "[font-variation-settings:'FILL'_1]" : ""}`}>swords</span>
                        </Link>

                        <Link
                            href="/notes"
                            className={`relative rounded-xl flex items-center justify-center transition-all font-bold py-3 h-auto group transform transition-transform duration-75 ${isActive('/notes')
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-none'
                                : 'bg-transparent text-muted-foreground'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-2xl relative z-10 transition-transform duration-75 group-active:scale-90 ${isActive('/notes') ? "[font-variation-settings:'FILL'_1]" : ""}`}>menu_book</span>
                        </Link>

                        {/* Center Quick Add Button */}
                        <div className="flex items-center justify-center relative">
                            <button
                                onClick={onToggleQuickAdd}
                                className={`h-14 w-14 rounded-2xl text-white transition-all duration-200 flex items-center justify-center border-b-[5px] active:border-b-0 active:translate-y-[5px] mb-2 ${isQuickAddOpen
                                    ? 'bg-red-500 border-red-600'
                                    : 'bg-green-500 border-green-600'
                                    }`}
                            >
                                <motion.div
                                    animate={{ rotate: isQuickAddOpen ? 45 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Plus className="h-8 w-8 stroke-[4px]" />
                                </motion.div>
                            </button>
                        </div>

                        <Link
                            href="/social"
                            className={`relative rounded-xl flex items-center justify-center transition-all font-bold py-3 h-auto group transform transition-transform duration-75 ${isActive('/social')
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-none'
                                : 'bg-transparent text-muted-foreground'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-2xl relative z-10 transition-transform duration-75 group-active:scale-90 ${isActive('/social') ? "[font-variation-settings:'FILL'_1]" : ""}`}>group</span>
                        </Link>

                        {/* More Menu Button */}
                        <button
                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                            className={`relative rounded-xl transition-all font-bold py-3 h-auto group transform transition-transform duration-75 flex items-center justify-center ${isMoreActive
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-500'
                                : 'text-muted-foreground'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-2xl relative z-10 transition-transform duration-75 group-active:scale-90 ${isMoreActive ? "[font-variation-settings:'FILL'_1]" : ""}`}>
                                more_horiz
                            </span>
                        </button>
                    </div>
                </div>
            </nav>
        </>
    );
}
