"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Edit2, Trash2, Pin, MoreVertical, Tag, Mic } from "lucide-react";
import { Weblog } from "@/hooks/use-weblogs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WeblogItemProps {
    weblog: Weblog;
    onEdit: (weblog: Weblog) => void;
    onDelete: (id: any) => void;
    onTogglePin: (id: any) => void;
}

export function WeblogItem({ weblog, onEdit, onDelete, onTogglePin }: WeblogItemProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const stickyNoteStyle = "bg-[#FEF9C3] dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50";

    const sanitizeHtml = (html: string) => {
        if (!html) return "";
        return html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
            .replace(/<object\b[^>]*>([\s\S]*?)<\/object>/gim, "")
            .replace(/on\w+="[^"]*"/g, "")
            .replace(/javascript:/gi, "");
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={cn(
                "group relative flex flex-col p-4 md:p-5 rounded-2xl border-2 border-b-4 transition-all shadow-sm hover:shadow-md cursor-pointer min-h-[140px] md:min-h-[160px]",
                stickyNoteStyle
            )}
            onClick={() => onEdit(weblog)}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/50 flex items-center justify-center text-lg md:text-xl shadow-sm border border-black/5 shrink-0">
                        {weblog.emoji || "📝"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className={cn(
                            "font-black text-base md:text-lg leading-tight truncate text-slate-800 dark:text-slate-100",
                            weblog.isPinned && "flex items-center gap-1.5"
                        )}>
                            {weblog.title || "Untitled Note"}
                            {weblog.isPinned && <Pin className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-600 fill-amber-600 shrink-0 inline-block" />}
                        </h3>
                        <p className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider text-slate-500/80 mt-0.5">
                            {weblog.category || "Uncategorized"} • {formatDistanceToNow(new Date(weblog.updatedAt), { addSuffix: true })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-black/5 text-slate-500"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 md:w-40 rounded-xl font-bold border-2 border-slate-200">
                            <DropdownMenuItem onClick={() => onTogglePin(weblog._id)} className="cursor-pointer text-sm">
                                <Pin className="w-4 h-4 mr-2" />
                                {weblog.isPinned ? "Unpin" : "Pin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(weblog)} className="cursor-pointer text-sm">
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setShowDeleteDialog(true);
                                }}
                                className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer text-sm"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Note</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this note?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(weblog._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Content Preview */}
            <div className="flex-1 mb-2 overflow-hidden">
                {weblog.content ? (
                    <div
                        className="text-xs md:text-sm font-medium text-slate-700/80 dark:text-slate-300 line-clamp-2 md:line-clamp-3 leading-relaxed [&_h1]:text-sm [&_h1]:font-bold [&_h1]:m-0 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:m-0 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:m-0 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-4 [&_ol]:m-0 [&_ol]:pl-4 [&_li]:m-0 [&_blockquote]:m-0 [&_blockquote]:pl-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-400/50 [&_img]:hidden"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(weblog.content) }}
                    />
                ) : (
                    <p className="text-xs md:text-sm font-medium text-slate-700/80 dark:text-slate-300 italic opacity-50">
                        Empty note...
                    </p>
                )}
            </div>

            {/* Tags and Audio Indicator */}
            <div className="flex items-center gap-1 flex-wrap mt-auto">
                {weblog.rawTranscript && (
                    <Badge
                        variant="secondary"
                        className="bg-indigo-100 text-indigo-500 font-medium rounded-md px-1.5 py-0 border-0 flex items-center gap-1"
                    >
                        <Mic className="w-3 h-3" />
                        <span className="text-[9px] md:text-[10px]">Audio</span>
                    </Badge>
                )}
                {weblog.tags && weblog.tags.length > 0 && (
                    <>
                        {weblog.tags.slice(0, 3).map(tag => (
                            <Badge
                                key={tag}
                                variant="secondary"
                                className="bg-white/60 text-slate-500 font-medium rounded-md px-1.5 py-0 text-[9px] md:text-[10px] border-0"
                            >
                                #{tag}
                            </Badge>
                        ))}
                        {weblog.tags.length > 3 && (
                            <span className="text-[9px] md:text-[10px] text-slate-400 font-medium">
                                +{weblog.tags.length - 3}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Corner Fold Effect */}
            <div className="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 pointer-events-none overflow-hidden rounded-tr-xl">
                <div className="absolute top-0 right-0 w-0 h-0 border-t-[24px] md:border-t-[32px] border-r-[24px] md:border-r-[32px] border-t-black/5 border-r-transparent transform rotate-90 scale-0 group-hover:scale-100 transition-transform origin-top-right"></div>
            </div>
        </motion.div>
    );
}
