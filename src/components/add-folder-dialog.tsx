"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompactIconPicker } from "./icon-picker";

export const COLORS = [
  "bg-blue-600/20 border-blue-600/30",
  "bg-purple-600/20 border-purple-600/30",
  "bg-cyan-600/20 border-cyan-600/30",
  "bg-rose-600/20 border-rose-600/30",
  "bg-amber-600/20 border-amber-600/30",
  "bg-indigo-600/20 border-indigo-600/30",
  "bg-emerald-600/20 border-emerald-600/30",
  "bg-orange-600/20 border-orange-600/30",
  "bg-pink-600/20 border-pink-600/30",
  "bg-violet-600/20 border-violet-600/30",
  "bg-teal-600/20 border-teal-600/30",
  "bg-sky-600/20 border-sky-600/30",
  "bg-lime-600/20 border-lime-600/30",
  "bg-yellow-600/20 border-yellow-600/30",
  "bg-fuchsia-600/20 border-fuchsia-600/30",
  "bg-slate-600/20 border-slate-600/30",
];

interface AddFolderDialogProps {
  children?: React.ReactNode;
  onAddFolder: (folderData: { name: string; icon: string; color: string }) => void;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function AddFolderDialog({ children, onAddFolder, defaultOpen = false, onOpenChange, isOpen, onClose }: AddFolderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState("📁");

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedIcon) return;

    onAddFolder({
      name,
      color: selectedColor,
      icon: selectedIcon,
    });

    setName("");
    setSelectedIcon("📁");
    setSelectedColor(COLORS[0]);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="w-[90vw] max-w-[600px] bg-white border-2 border-b-8 border-[#CBD5E1] text-[#1E293B] rounded-[2rem] shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogTitle className="sr-only">Create New Folder</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F1F4F9] border-2 border-b-4 border-[#CBD5E1] flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#1E293B] stroke-[3]" />
            </div>
            <h2 className="text-lg font-black font-headline uppercase tracking-tight text-[#1E293B]">New Folder</h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-[11px] font-black uppercase tracking-[0.15em] text-[#64748B]">Folder Name & Icon</Label>
              <div className="flex items-center gap-3">
                <CompactIconPicker
                  selectedIcon={selectedIcon}
                  onSelectIcon={setSelectedIcon}
                  selectedColor={selectedColor}
                  onSelectColor={setSelectedColor}
                  colors={COLORS}
                />
                <Input
                  id="title"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Ideas"
                  autoFocus
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
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-9 h-9 rounded-full border-3 transition-all shadow-sm active:scale-90 cursor-pointer",
                      color.split(' ')[0],
                      selectedColor === color ? "scale-125 border-[#1E293B] shadow-md" : "border-transparent hover:scale-110"
                    )}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E2E8F0] px-6 py-4 bg-white flex-shrink-0">
          <Button
            type="submit"
            disabled={!name.trim() || !selectedIcon}
            onClick={handleSubmit}
            className="w-full h-14 rounded-2xl bg-[#6366f1] border-2 border-b-[6px] border-[#4f46e5] text-white hover:bg-[#818cf8] hover:border-[#6366f1] font-black text-lg uppercase tracking-wider active:translate-y-[2px] active:border-b-[4px] transition-all shadow-lg relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-white/40 z-10 pointer-events-none" />
            Create Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
