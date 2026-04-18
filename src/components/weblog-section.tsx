"use client";

import { useState, useCallback, DragEvent } from "react";
import { Plus, Search, Tag, X, FolderOpen, ChevronLeft, Inbox, GripVertical, FolderInput, Mic, Loader2, Pencil, MoreVertical, Trash2 } from "lucide-react";
import { useWeblogs, Weblog } from "@/hooks/use-weblogs";
import { useWeblogFolders, WeblogFolder } from "@/hooks/use-weblog-folders";
import { WeblogItem } from "./weblog-item";
import { WeblogEditor } from "./weblog-editor";
import { AddFolderDialog, COLORS } from "./add-folder-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "./ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";
import { Label } from "./ui/label";
import { CompactIconPicker } from "./icon-picker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { Doc } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface WeblogSectionProps {
    initialWeblogs?: Doc<"weblogs">[];
}

export function WeblogSection({ initialWeblogs }: WeblogSectionProps) {
    const { weblogs, allTags, addWeblog, updateWeblog, deleteWeblog, togglePin } = useWeblogs(initialWeblogs);
    const { folders, addFolder, updateFolder, deleteFolder } = useWeblogFolders();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingWeblog, setEditingWeblog] = useState<Weblog | null>(null);
    const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
    const [isEditFolderOpen, setIsEditFolderOpen] = useState(false);
    const [isDeleteFolderConfirmOpen, setIsDeleteFolderConfirmOpen] = useState(false);
    const [editFolderName, setEditFolderName] = useState("");
    const [editFolderIcon, setEditFolderIcon] = useState("📁");
    const [editFolderColor, setEditFolderColor] = useState(COLORS[0]);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [showUnfiled, setShowUnfiled] = useState(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);

    // View mode: "folders" (grid of folders) or "folder-content" (inside a folder)
    const isInsideFolder = selectedFolderId !== null;
    const isViewingUnfiled = showUnfiled;

    // Categorize weblogs
    const unfiledWeblogs = weblogs?.filter(w => !w.folderId) || [];
    const getWeblogsInFolder = (folderId: string) => weblogs?.filter(w => w.folderId === folderId) || [];

    // Current view weblogs
    const currentWeblogs = (() => {
        let list: Weblog[] = [];
        if (isInsideFolder) {
            list = getWeblogsInFolder(selectedFolderId!);
        } else if (isViewingUnfiled) {
            list = unfiledWeblogs;
        } else {
            list = weblogs || [];
        }

        // Search filter
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            list = list.filter(log =>
                (log.title?.toLowerCase() || "").includes(searchLower) ||
                (log.content?.toLowerCase() || "").includes(searchLower) ||
                (log.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false)
            );
        }

        // Tag filter
        if (selectedTags.length > 0) {
            list = list.filter(log =>
                selectedTags.every(tag => log.tags?.includes(tag))
            );
        }

        return list;
    })();

    const handleCreateNew = () => {
        setEditingWeblog(null);
        setEditorOpen(true);
    };

    const handleEdit = (weblog: Weblog) => {
        setEditingWeblog(weblog);
        setEditorOpen(true);
    };

    const handleSave = async (data: any, isAutoSave = false): Promise<string | void> => {
        // If we're inside a folder, auto-attach folderId for new notes
        const saveData = { ...data };
        if (isInsideFolder && !data.id && !data.folderId) {
            saveData.folderId = selectedFolderId;
        }
        let savedId: string | void;
        if (data.id) {
            await updateWeblog(data.id, saveData);
            savedId = String(data.id);
        } else {
            const createdId = await addWeblog(saveData);
            savedId = createdId ? String(createdId) : undefined;
        }
        
        // Only close editor if it's NOT an auto-save
        if (!isAutoSave) {
            setEditorOpen(false);
        }

        return savedId;
    };

    const toggleTagFilter = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const clearFilters = () => {
        setSelectedTags([]);
        setSearchQuery("");
    };

    const goBack = () => {
        setSelectedFolderId(null);
        setShowUnfiled(false);
        setSearchQuery("");
        setSelectedTags([]);
    };

    const currentFolder = folders.find(f => f._id === selectedFolderId);

    const openEditFolderDialog = useCallback(() => {
        if (!currentFolder) return;
        setEditFolderName(currentFolder.name);
        setEditFolderIcon(currentFolder.icon || "📁");
        setEditFolderColor(currentFolder.color || COLORS[0]);
        setIsEditFolderOpen(true);
    }, [currentFolder]);

    const handleUpdateFolder = useCallback(async () => {
        if (!currentFolder || !editFolderName.trim()) return;

        await updateFolder(String(currentFolder._id), {
            name: editFolderName.trim(),
            icon: editFolderIcon,
            color: editFolderColor,
        });

        setIsEditFolderOpen(false);
    }, [currentFolder, editFolderColor, editFolderIcon, editFolderName, updateFolder]);

    const handleDeleteFolder = useCallback(async () => {
        if (!currentFolder) return;

        const folderId = String(currentFolder._id);
        const folderWeblogs = weblogs.filter(weblog => weblog.folderId === folderId);

        await Promise.all(
            folderWeblogs.map(weblog => updateWeblog(weblog._id, { folderId: undefined }))
        );

        await deleteFolder(folderId);
        setIsEditFolderOpen(false);
        setIsDeleteFolderConfirmOpen(false);
        setSelectedFolderId(null);
    }, [currentFolder, deleteFolder, updateWeblog, weblogs]);

    const openDeleteFolderConfirm = useCallback(() => {
        if (!currentFolder) return;
        setIsDeleteFolderConfirmOpen(true);
    }, [currentFolder]);

    // ─── Drag & Drop ───

    const handleDragStart = useCallback((e: DragEvent, weblogId: string) => {
        e.dataTransfer.setData("text/plain", weblogId);
        e.dataTransfer.effectAllowed = "move";
    }, []);

    const handleDragOver = useCallback((e: DragEvent, folderId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverFolderId(folderId);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverFolderId(null);
    }, []);

    const handleDrop = useCallback(async (e: DragEvent, folderId: string) => {
        e.preventDefault();
        setDragOverFolderId(null);
        const weblogId = e.dataTransfer.getData("text/plain");
        if (weblogId) {
            await updateWeblog(weblogId, { folderId });
        }
    }, [updateWeblog]);

    const handleDropToUnfiled = useCallback(async (e: DragEvent) => {
        e.preventDefault();
        setDragOverFolderId(null);
        const weblogId = e.dataTransfer.getData("text/plain");
        if (weblogId) {
            await updateWeblog(weblogId, { folderId: undefined });
        }
    }, [updateWeblog]);

    const hasActiveFilters = selectedTags.length > 0 || searchQuery;

    // ─── Folder grid view ───
    if (!isInsideFolder && !isViewingUnfiled) {
        return (
            <div className="flex flex-col h-full gap-4 md:gap-6 pb-24 relative">
                {/* Search bar */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notes..."
                            className="pl-9 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-slate-400 font-bold placeholder:font-normal h-9 md:h-10"
                        />
                    </div>
                </div>

                {/* If searching, show all matching results */}
                {searchQuery ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-600">
                                {currentWeblogs.length} result{currentWeblogs.length !== 1 ? 's' : ''} for "{searchQuery}"
                            </span>
                            <button onClick={() => setSearchQuery("")} className="ml-auto text-xs text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 auto-rows-max">
                            <AnimatePresence mode="popLayout">
                                {currentWeblogs.map((weblog) => (
                                    <DraggableWeblogItem
                                        key={weblog._id}
                                        weblog={weblog}
                                        onEdit={handleEdit}
                                        onDelete={deleteWeblog}
                                        onTogglePin={togglePin}
                                        onDragStart={handleDragStart}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Folders Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                            {/* Unfiled Notes Card */}
                            <motion.button
                                whileHover={{ scale: 1.03, y: -3 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setShowUnfiled(true)}
                                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId("unfiled"); }}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDropToUnfiled}
                                className={cn(
                                    "relative flex flex-col items-center justify-center p-4 md:p-6 min-h-[130px] md:min-h-[160px] rounded-2xl border-2 border-b-4 transition-all cursor-pointer group",
                                    dragOverFolderId === "unfiled"
                                        ? "bg-blue-50 border-blue-400 scale-105 shadow-lg"
                                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                                )}
                            >
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white border-2 border-b-4 border-slate-200 flex items-center justify-center mb-2 md:mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                    <Inbox className="w-6 h-6 md:w-7 md:h-7 text-slate-400" />
                                </div>
                                <span className="font-black text-slate-600 uppercase tracking-widest text-[10px] md:text-xs">Unfiled</span>
                                <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    {unfiledWeblogs.length} note{unfiledWeblogs.length !== 1 ? 's' : ''}
                                </span>
                            </motion.button>

                            {/* Existing Folders */}
                            {folders.map(folder => {
                                const folderWeblogs = getWeblogsInFolder(String(folder._id));
                                const isDragTarget = dragOverFolderId === String(folder._id);
                                const bgColorClass = folder.color.split(' ')[0];
                                const borderColorClass = folder.color.split(' ')[1] || '';

                                return (
                                    <motion.button
                                        key={folder._id}
                                        whileHover={{ scale: 1.03, y: -3 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setSelectedFolderId(String(folder._id))}
                                        onDragOver={(e) => handleDragOver(e as unknown as DragEvent, String(folder._id))}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e as unknown as DragEvent, String(folder._id))}
                                        className={cn(
                                            "relative flex flex-col items-center justify-center p-4 md:p-6 min-h-[130px] md:min-h-[160px] rounded-2xl border-2 border-b-4 transition-all cursor-pointer group",
                                            isDragTarget
                                                ? "scale-105 shadow-lg ring-2 ring-indigo-400 ring-offset-2 " + bgColorClass + " " + borderColorClass
                                                : bgColorClass + " " + borderColorClass + " hover:shadow-md"
                                        )}
                                    >
                                        {isDragTarget && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="absolute inset-0 bg-indigo-400/10 rounded-2xl flex items-center justify-center z-10"
                                            >
                                                <FolderInput className="w-8 h-8 text-indigo-500 animate-bounce" />
                                            </motion.div>
                                        )}
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/70 border-2 border-b-4 border-white/50 flex items-center justify-center mb-2 md:mb-3 shadow-sm group-hover:scale-110 transition-transform text-2xl md:text-3xl">
                                            {folder.icon}
                                        </div>
                                        <span className="font-black text-slate-700 uppercase tracking-widest text-[10px] md:text-xs">
                                            {folder.name}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            {folderWeblogs.length} note{folderWeblogs.length !== 1 ? 's' : ''}
                                        </span>
                                    </motion.button>
                                );
                            })}

                            {/* Add Folder Card */}
                            <motion.button
                                whileHover={{ scale: 1.03, y: -3 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setIsAddFolderOpen(true)}
                                className="flex flex-col items-center justify-center p-4 md:p-6 min-h-[130px] md:min-h-[160px] rounded-2xl border-4 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50/30 hover:bg-slate-50 transition-all group cursor-pointer"
                            >
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center mb-2 md:mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                    <Plus className="w-6 h-6 md:w-7 md:h-7 text-slate-300 group-hover:text-slate-500" />
                                </div>
                                <span className="font-black text-slate-400 group-hover:text-slate-500 uppercase tracking-widest text-[10px] md:text-xs">New Folder</span>
                            </motion.button>
                        </div>

                        {/* Recent / All Notes section below folders */}
                        <div className="flex flex-col gap-3 mt-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4" />
                                    Recent Notes
                                </h3>
                                <Button
                                    variant="ghost"
                                    onClick={handleCreateNew}
                                    className="h-8 px-3 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    New Note
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 auto-rows-max">
                                <AnimatePresence mode="popLayout">
                                    {isProcessingAudio && !editorOpen && (
                                        <WeblogAnalyzingItem key="analyzing-note" />
                                    )}
                                    {(weblogs || []).slice(0, 6).map((weblog) => (
                                        <DraggableWeblogItem
                                            key={weblog._id}
                                            weblog={weblog}
                                            onEdit={handleEdit}
                                            onDelete={deleteWeblog}
                                            onTogglePin={togglePin}
                                            onDragStart={handleDragStart}
                                            folder={folders.find(f => String(f._id) === weblog.folderId)}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </>
                )}

                <AddFolderDialog
                    isOpen={isAddFolderOpen}
                    onClose={() => setIsAddFolderOpen(false)}
                    onAddFolder={addFolder}
                />

                <WeblogEditor
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                weblog={editingWeblog}
                onSave={handleSave}
                onProcessingStatusChange={setIsProcessingAudio}
                existingTags={allTags}
                folders={folders}
                initialFolderId={isInsideFolder ? selectedFolderId : null}
            />
        </div>
    );
}

function WeblogAnalyzingItem() {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                transition: { 
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                }
            }}
            className="group relative flex flex-col p-4 md:p-5 rounded-2xl border-2 border-b-4 border-indigo-200 bg-indigo-50/50 transition-all shadow-sm min-h-[140px] md:min-h-[160px] overflow-hidden"
        >
            {/* Shimmer effect */}
            <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full"
                animate={{
                    translateX: ["100%", "-100%"],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                }}
            />
            
            <div className="flex items-start gap-3 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-indigo-100 relative">
                    <div className="absolute inset-0 bg-indigo-400/20 rounded-xl animate-ping" />
                    <Mic className="w-5 h-5 text-indigo-500 animate-pulse" />
                </div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-indigo-200/50 rounded-md w-3/4 animate-pulse" />
                    <div className="h-3 bg-indigo-100/50 rounded-md w-1/2 animate-pulse" />
                </div>
            </div>
            
            <div className="flex-1 space-y-2 relative z-10">
                <div className="h-3 bg-slate-200/50 rounded-md w-full animate-pulse" />
                <div className="h-3 bg-slate-200/50 rounded-md w-5/6 animate-pulse" />
                <div className="h-3 bg-slate-200/50 rounded-md w-4/6 animate-pulse" />
            </div>
            
            <div className="mt-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Analyzing...</span>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Inside a folder / Unfiled view ───
    return (
        <div className="flex flex-col h-full gap-4 md:gap-6 pb-24 relative">
            {/* Header with back nav */}
            <div className="flex flex-col gap-3 md:gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={goBack}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border-2 border-b-4 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all font-bold text-xs uppercase tracking-wider"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isInsideFolder && currentFolder ? (
                            <>
                                <span className="text-2xl">{currentFolder.icon}</span>
                                <h2 className="font-black text-lg text-slate-800 uppercase tracking-wide truncate">
                                    {currentFolder.name}
                                </h2>
                                <span className="text-xs font-bold text-slate-400 shrink-0">
                                    ({currentWeblogs.length} note{currentWeblogs.length !== 1 ? 's' : ''})
                                </span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                                            aria-label="Folder menu"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl border-2 border-slate-200 shadow-lg min-w-40">
                                        <DropdownMenuItem onClick={openEditFolderDialog} className="font-bold cursor-pointer">
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit folder
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={openDeleteFolderConfirm} className="font-bold text-rose-600 focus:text-rose-600 cursor-pointer">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete folder
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        ) : (
                            <>
                                <Inbox className="w-6 h-6 text-slate-500" />
                                <h2 className="font-black text-lg text-slate-800 uppercase tracking-wide">
                                    Unfiled Notes
                                </h2>
                                <span className="text-xs font-bold text-slate-400 shrink-0">
                                    ({currentWeblogs.length})
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Search and tags */}
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-start md:items-center">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search in folder..."
                            className="pl-9 bg-white border-2 border-slate-200 rounded-xl focus-visible:ring-0 focus-visible:border-slate-400 font-bold placeholder:font-normal h-9 md:h-10"
                        />
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 shrink-0"
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </button>
                    )}
                </div>

                {/* Tags row */}
                {allTags.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="flex items-center gap-1.5 flex-nowrap">
                            {allTags.map(tag => (
                                <Badge
                                    key={tag}
                                    variant="secondary"
                                    onClick={() => toggleTagFilter(tag)}
                                    className={`cursor-pointer rounded-lg px-2 py-0.5 text-[10px] md:text-xs font-medium shrink-0 transition-all ${
                                        selectedTags.includes(tag)
                                            ? "bg-slate-800 text-white hover:bg-slate-700"
                                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                    }`}
                                >
                                    #{tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Notes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 auto-rows-max">
                {/* Create New Card */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateNew}
                    className="flex flex-col items-center justify-center p-4 md:p-6 min-h-[120px] md:min-h-[160px] rounded-2xl border-4 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100 transition-all group cursor-pointer"
                >
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center mb-2 md:mb-3 shadow-sm group-hover:scale-110 transition-transform">
                        <Plus className="w-5 h-5 md:w-6 md:h-6 text-slate-400 group-hover:text-slate-600" />
                    </div>
                    <span className="font-black text-slate-400 group-hover:text-slate-600 uppercase tracking-widest text-xs md:text-sm">
                        Create Note
                    </span>
                </motion.button>

                <AnimatePresence mode="popLayout">
                    {isProcessingAudio && !editorOpen && (
                        <WeblogAnalyzingItem key="analyzing-note-folder" />
                    )}
                    {currentWeblogs.map((weblog) => (
                        <DraggableWeblogItem
                            key={weblog._id}
                            weblog={weblog}
                            onEdit={handleEdit}
                            onDelete={deleteWeblog}
                            onTogglePin={togglePin}
                            onDragStart={handleDragStart}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {currentWeblogs.length === 0 && (searchQuery || selectedTags.length > 0) && (
                <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center opacity-60">
                    <Search className="w-10 h-10 md:w-12 md:h-12 mb-3 md:mb-4 text-slate-300" />
                    <p className="font-black text-slate-400 text-base md:text-lg">No matches found</p>
                    <button
                        onClick={clearFilters}
                        className="mt-2 text-sm text-blue-500 hover:text-blue-600 font-medium"
                    >
                        Clear all filters
                    </button>
                </div>
            )}

            {currentWeblogs.length === 0 && !searchQuery && selectedTags.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-b-4 border-slate-200 flex items-center justify-center mb-4">
                        <FolderOpen className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-black text-slate-400 text-lg uppercase tracking-wider mb-1">Empty</p>
                    <p className="text-sm text-slate-400 font-medium">
                        {isViewingUnfiled
                            ? "All your notes are organized in folders"
                            : "Drag notes here or create a new one"
                        }
                    </p>
                </div>
            )}

            <WeblogEditor
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                weblog={editingWeblog}
                onSave={handleSave}
                onProcessingStatusChange={setIsProcessingAudio}
                existingTags={allTags}
                folders={folders}
                initialFolderId={isInsideFolder ? selectedFolderId : null}
            />

            <Dialog open={isEditFolderOpen} onOpenChange={setIsEditFolderOpen}>
                <DialogContent className="w-[90vw] max-w-[560px] bg-white border-2 border-b-8 border-[#CBD5E1] text-[#1E293B] rounded-[2rem] shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <DialogTitle className="sr-only">Edit Folder</DialogTitle>

                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-white flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#F1F4F9] border-2 border-b-4 border-[#CBD5E1] flex items-center justify-center">
                                <Pencil className="w-5 h-5 text-[#1E293B] stroke-[3]" />
                            </div>
                            <h2 className="text-lg font-black font-headline uppercase tracking-tight text-[#1E293B]">Edit Folder</h2>
                        </div>
                    </div>

                    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                        <div className="space-y-2">
                            <Label htmlFor="folder-name" className="text-[11px] font-black uppercase tracking-[0.15em] text-[#64748B]">Folder Name & Icon</Label>
                            <div className="flex items-center gap-3">
                                <CompactIconPicker
                                    selectedIcon={editFolderIcon}
                                    onSelectIcon={setEditFolderIcon}
                                    selectedColor={editFolderColor}
                                    onSelectColor={setEditFolderColor}
                                    colors={COLORS}
                                />
                                <Input
                                    id="folder-name"
                                    value={editFolderName}
                                    onChange={(e) => setEditFolderName(e.target.value)}
                                    placeholder="Folder name"
                                    className="flex-1 bg-white border-2 border-b-4 border-[#E2E8F0] focus-visible:border-[#CBD5E1] focus-visible:ring-0 h-14 rounded-lg text-sm font-bold text-[#1E293B] placeholder:text-[#CBD5E1] transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-[#64748B]">Folder Color</Label>
                            <div className="flex gap-2 flex-wrap">
                                {COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setEditFolderColor(color)}
                                        className={cn(
                                            "w-9 h-9 rounded-full border-3 transition-all shadow-sm active:scale-90 cursor-pointer",
                                            color.split(' ')[0],
                                            editFolderColor === color ? "scale-125 border-[#1E293B] shadow-md" : "border-transparent hover:scale-110"
                                        )}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-[#E2E8F0] px-6 py-4 bg-white flex-shrink-0 flex-row gap-2 sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditFolderOpen(false)}
                            className="h-11 rounded-xl border-2 border-[#CBD5E1] px-5 font-black"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!editFolderName.trim()}
                            onClick={handleUpdateFolder}
                            className="h-11 rounded-xl bg-[#6366f1] border-2 border-b-[6px] border-[#4f46e5] text-white hover:bg-[#818cf8] hover:border-[#6366f1] px-5 font-black active:translate-y-[2px] active:border-b-[4px] transition-all"
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteFolderConfirmOpen} onOpenChange={setIsDeleteFolderConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the folder, but your notes will stay and be moved back to unfiled.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteFolder} className="bg-rose-600 text-white hover:bg-rose-700">
                            Delete folder
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function WeblogAnalyzingItem() {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                transition: { 
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                }
            }}
            className="group relative flex flex-col p-4 md:p-5 rounded-2xl border-2 border-b-4 border-indigo-200 bg-indigo-50/50 transition-all shadow-sm min-h-[140px] md:min-h-[160px] overflow-hidden"
        >
            {/* Shimmer effect */}
            <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full"
                animate={{
                    translateX: ["100%", "-100%"],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                }}
            />
            
            <div className="flex items-start gap-3 mb-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-indigo-100 relative">
                    <div className="absolute inset-0 bg-indigo-400/20 rounded-xl animate-ping" />
                    <Mic className="w-5 h-5 text-indigo-500 animate-pulse" />
                </div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-indigo-200/50 rounded-md w-3/4 animate-pulse" />
                    <div className="h-3 bg-indigo-100/50 rounded-md w-1/2 animate-pulse" />
                </div>
            </div>
            
            <div className="flex-1 space-y-2 relative z-10">
                <div className="h-3 bg-slate-200/50 rounded-md w-full animate-pulse" />
                <div className="h-3 bg-slate-200/50 rounded-md w-5/6 animate-pulse" />
                <div className="h-3 bg-slate-200/50 rounded-md w-4/6 animate-pulse" />
            </div>
            
            <div className="mt-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Analyzing...</span>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Draggable wrapper for WeblogItem ───

interface DraggableWeblogItemProps {
    weblog: Weblog;
    onEdit: (weblog: Weblog) => void;
    onDelete: (id: any) => void;
    onTogglePin: (id: any) => void;
    onDragStart: (e: DragEvent, id: string) => void;
    folder?: WeblogFolder;
}

function DraggableWeblogItem({ weblog, onEdit, onDelete, onTogglePin, onDragStart, folder }: DraggableWeblogItemProps) {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <div
            draggable
            onDragStart={(e) => {
                setIsDragging(true);
                onDragStart(e as unknown as DragEvent, String(weblog._id));
            }}
            onDragEnd={() => setIsDragging(false)}
            className={cn(
                "relative transition-all",
                isDragging && "opacity-40 scale-95"
            )}
        >
            {/* Drag Handle Indicator */}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <GripVertical className="w-4 h-4 text-slate-300" />
            </div>

            {/* Folder badge */}
            {folder && (
                <div className="absolute -top-2 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-sm">
                    <span className="text-xs">{folder.icon}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{folder.name}</span>
                </div>
            )}

            <WeblogItem
                weblog={weblog}
                onEdit={onEdit}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
            />
        </div>
    );
}
