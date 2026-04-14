"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Weblog } from "@/hooks/use-weblogs";
import {
    X, Save, Bold, Italic, List, ListOrdered, CheckSquare,
    Link as LinkIcon, Image as ImageIcon, Quote, Heading1, Heading2,
    Heading3, Code, Undo, Redo, Download, FileText, Tag, Plus,
    Underline, Strikethrough, Maximize2, Minimize2, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompactIconPicker } from "./icon-picker";
import { Badge } from "@/components/ui/badge";
import { WeblogFolder } from "@/hooks/use-weblog-folders";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mic, Square, Loader2, Eye, EyeOff, Pause, Play } from "lucide-react";
import { marked } from "marked";

// Default color for weblog icons
const DEFAULT_ICON_COLOR = "bg-amber-100";
const ICON_COLORS = [DEFAULT_ICON_COLOR];
const AUTOSAVE_IDLE_MS = 3000;

interface WeblogEditorProps {
    isOpen: boolean;
    onClose: () => void;
    weblog?: Weblog | null;
    onSave: (data: any, isAutoSave?: boolean) => Promise<string | void>;
    onProcessingStatusChange?: (isProcessing: boolean) => void;
    existingTags?: string[];
    folders: WeblogFolder[];
    initialFolderId?: string | null;
}

export function WeblogEditor({ isOpen, onClose, weblog, onSave, onProcessingStatusChange, existingTags = [], folders = [], initialFolderId = null }: WeblogEditorProps) {
    const [title, setTitle] = useState("");
    const [emoji, setEmoji] = useState("📝");
    const [folderId, setFolderId] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
    const [autosaveTrigger, setAutosaveTrigger] = useState(0);
    const [currentNoteId, setCurrentNoteId] = useState<string | null>(weblog?._id ? String(weblog._id) : null);
    const [showCloseWarning, setShowCloseWarning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    // Audio feature states
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    const [rawTranscript, setRawTranscript] = useState<string | undefined>(undefined);
    const [showRawTranscript, setShowRawTranscript] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    
    // State refs for background saving
    const titleRef = useRef(title);
    const emojiRef = useRef(emoji);
    const folderIdRef = useRef(folderId);
    const tagsRef = useRef(tags);
    const rawTranscriptRef = useRef(rawTranscript);
    const currentNoteIdRef = useRef<string | null>(currentNoteId);
    const isProcessingAudioRef = useRef(false);
    const isMountedRef = useRef(false);
    const shouldSaveOnCompleteRef = useRef(false);
    const lastAutoSavedFingerprintRef = useRef<string>("");
    const hasPendingChangesRef = useRef(false);
    const lastEditAtRef = useRef(0);

    useEffect(() => {
        titleRef.current = title;
    }, [title]);
    useEffect(() => {
        emojiRef.current = emoji;
    }, [emoji]);
    useEffect(() => {
        folderIdRef.current = folderId;
    }, [folderId]);
    useEffect(() => {
        tagsRef.current = tags;
    }, [tags]);
    useEffect(() => {
        rawTranscriptRef.current = rawTranscript;
    }, [rawTranscript]);
    useEffect(() => {
        currentNoteIdRef.current = currentNoteId;
    }, [currentNoteId]);
    
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recorderMimeTypeRef = useRef<string>("audio/webm");
    const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
    const processAudioNote = useAction(api.audio.processAudioNote);

    useEffect(() => {
        if (isProcessingAudio !== undefined) {
            onProcessingStatusChange?.(isProcessingAudio);
        }
    }, [isProcessingAudio, onProcessingStatusChange]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const preferredMimeTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/mp4",
            ];

            const selectedMimeType = preferredMimeTypes.find(
                (mime) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)
            );

            const mediaRecorder = selectedMimeType
                ? new MediaRecorder(stream, { mimeType: selectedMimeType })
                : new MediaRecorder(stream);

            recorderMimeTypeRef.current = selectedMimeType || mediaRecorder.mimeType || "audio/webm";
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setIsProcessingAudio(true);
                isProcessingAudioRef.current = true;
                
                // Reset recording timer and animations
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close().catch(console.error);
                }
                audioContextRef.current = null;
                analyserRef.current = null;
                animationFrameRef.current = null;
                
                if (isMountedRef.current) setRecordingTime(0);

                const audioBlob = new Blob(audioChunksRef.current, { type: recorderMimeTypeRef.current || "audio/webm" });
                
                // Capture current editor state to ensure we can save even if component unmounts
                const currentEditorContent = editorRef.current?.innerHTML || "";
                const currentTitle = titleRef.current;
                const currentEmoji = emojiRef.current;
                const currentFolderId = folderIdRef.current;
                const currentTags = tagsRef.current;
                const currentWeblogId = currentNoteIdRef.current || weblog?._id;
                const currentIsPinned = weblog?.isPinned;

                try {
                    // 1. Upload audio to Convex storage (handles >1MB better than raw base64 string)
                    const uploadUrl = await generateUploadUrl();
                    const result = await fetch(uploadUrl, {
                        method: "POST",
                        headers: { "Content-Type": audioBlob.type },
                        body: audioBlob,
                    });

                    if (!result.ok) {
                        throw new Error(`Audio upload failed: ${result.status} ${result.statusText}`);
                    }

                    const { storageId } = await result.json();
                    if (!storageId) {
                        throw new Error("Audio upload did not return a storageId");
                    }

                    // 2. Call Gemini action with storageId
                    const aiResponse = await processAudioNote({ storageId });
                    
                    // Construct final note data
                    const finalTitle = aiResponse.title || currentTitle || "Untitled Note";
                    const finalEmoji = aiResponse.emoji || currentEmoji || "📝";
                    const finalRawTranscript = aiResponse.rawTranscript || "";
                    
                    let finalContent = currentEditorContent;
                    if (aiResponse.structuredContent) {
                        const htmlContent = marked.parse(aiResponse.structuredContent, { 
                            gfm: true, 
                            breaks: true 
                        });
                        finalContent = finalContent 
                            ? finalContent + '<br><br>' + htmlContent
                            : htmlContent as string;
                    }

                    // 3. Auto-save in background if requested or if component is unmounting
                    if (shouldSaveOnCompleteRef.current || !isMountedRef.current) {
                        console.log("Saving audio note in background...");
                        await onSave({
                            id: currentWeblogId,
                            title: finalTitle,
                            content: finalContent,
                            emoji: finalEmoji,
                            folderId: currentFolderId || undefined,
                            tags: currentTags,
                            isPinned: currentIsPinned,
                            rawTranscript: finalRawTranscript
                        });
                        
                        // Clear draft since we've successfully saved in background
                        localStorage.removeItem(draftKey);
                    } else if (isMountedRef.current) {
                        // 4. Update editor UI if still mounted
                        if (aiResponse.title) setTitle(aiResponse.title);
                        if (aiResponse.emoji) setEmoji(aiResponse.emoji);
                        if (aiResponse.rawTranscript) setRawTranscript(aiResponse.rawTranscript);
                        
                        if (editorRef.current) {
                            editorRef.current.innerHTML = finalContent;
                        }
                        hasPendingChangesRef.current = true;
                        lastEditAtRef.current = Date.now();
                    }
                } catch (error) {
                    console.error("Failed to process audio end-to-end:", error);
                } finally {
                    if (isMountedRef.current) setIsProcessingAudio(false);
                    isProcessingAudioRef.current = false;
                    // Stop tracks
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setIsPaused(false);
            isPausedRef.current = false;
            setIsRecordingModalOpen(true);
            setRecordingTime(0);
            
            // Audio visualizer setup
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            
            const updateVisualizer = () => {
                if (!analyserRef.current || !canvasRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                if (!isPausedRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                } else {
                    // Smooth decay when paused
                    for (let i = 0; i < dataArray.length; i++) {
                        dataArray[i] = Math.max(0, dataArray[i] * 0.85);
                    }
                }
                
                const width = canvas.width;
                const height = canvas.height;
                ctx.clearRect(0, 0, width, height);
                
                // Draw smooth symmetrical wave
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#6366f1'; // indigo-500
                ctx.lineCap = 'round';
                
                const sliceWidth = width / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    // Use frequency data to determine bar height
                    const v = dataArray[i] / 255.0;
                    const barHeight = v * height * 0.8; // Max 80% height
                    
                    const y1 = (height - barHeight) / 2;
                    const y2 = (height + barHeight) / 2;

                    ctx.beginPath();
                    ctx.moveTo(x, y1);
                    ctx.lineTo(x, y2);
                    ctx.stroke();

                    x += sliceWidth + 1; // Add gap
                }

                animationFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            
            // Delay visualizer start slightly to ensure canvas is rendered
            setTimeout(() => {
                updateVisualizer();
            }, 100);

            recordingTimerRef.current = setInterval(() => {
                if (!isPausedRef.current) {
                    setRecordingTime(prev => prev + 1);
                }
            }, 1000);
        } catch (error) {
            console.error("Microphone Access Denied or Error:", error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && (isRecording || isPaused)) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            isPausedRef.current = false;
            setIsRecordingModalOpen(false);
            // Most cleanup happens in onstop to avoid double-closing AudioContext
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            isPausedRef.current = true;
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            isPausedRef.current = false;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    const [activeFormats, setActiveFormats] = useState<{
        bold: boolean;
        italic: boolean;
        underline: boolean;
        strikethrough: boolean;
        h1: boolean;
        h2: boolean;
        h3: boolean;
        blockquote: boolean;
        ul: boolean;
        ol: boolean;
        code: boolean;
    }>({
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        h1: false,
        h2: false,
        h3: false,
        blockquote: false,
        ul: false,
        ol: false,
        code: false,
    });
    const editorRef = useRef<HTMLDivElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);

    // Cleanup recording resources on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(console.error);
            }
        };
    }, []);

    // Detect mobile screen and set fullscreen by default
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setIsFullscreen(true);
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Check active formats on selection change
    const updateActiveFormats = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        // Check inline formats
        const bold = document.queryCommandState("bold");
        const italic = document.queryCommandState("italic");
        const underline = document.queryCommandState("underline");
        const strikethrough = document.queryCommandState("strikeThrough");

        // Check block formats
        let h1 = false, h2 = false, h3 = false, blockquote = false, ul = false, ol = false, code = false;
        
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
            const tagName = node.nodeName.toLowerCase();
            if (tagName === 'h1') h1 = true;
            if (tagName === 'h2') h2 = true;
            if (tagName === 'h3') h3 = true;
            if (tagName === 'blockquote') blockquote = true;
            if (tagName === 'ul') ul = true;
            if (tagName === 'ol') ol = true;
            if (tagName === 'code') code = true;
            node = node.parentNode;
        }

        setActiveFormats({ bold, italic, underline, strikethrough, h1, h2, h3, blockquote, ul, ol, code });
    }, []);

    // Draft key for localStorage
    const draftKey = useMemo(() => {
        return weblog?._id ? `weblog-draft-${weblog._id}` : 'weblog-draft-new';
    }, [weblog?._id]);

    // Check if there are unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        const currentContent = editorRef.current?.innerHTML || "";
        const originalContent = weblog?.content || "";
        const originalTitle = weblog?.title || "";
        const originalEmoji = weblog?.emoji || "📝";
        const originalFolderId = weblog?.folderId || null;
        const originalTags = weblog?.tags || [];
        
        return (
            title !== originalTitle ||
            emoji !== originalEmoji ||
            folderId !== originalFolderId ||
            currentContent !== originalContent ||
            JSON.stringify(tags) !== JSON.stringify(originalTags)
        );
    }, [title, emoji, folderId, tags, weblog]);

    const hasMeaningfulContent = useCallback(() => {
        const contentHtml = editorRef.current?.innerHTML || "";
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = contentHtml;
        const text = (tempDiv.textContent || tempDiv.innerText || "").replace(/\u00A0/g, " ").trim();

        return Boolean(
            title.trim() ||
            text ||
            rawTranscript?.trim() ||
            tags.length > 0
        );
    }, [title, rawTranscript, tags]);

    // Save draft to localStorage
    const saveDraft = useCallback(() => {
        const draft = {
            title,
            emoji,
            folderId,
            tags,
            rawTranscript,
            content: editorRef.current?.innerHTML || "",
            savedAt: Date.now()
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
    }, [title, emoji, folderId, tags, rawTranscript, draftKey]);

    // Load draft from localStorage
    const loadDraft = useCallback(() => {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            try {
                return JSON.parse(savedDraft);
            } catch {
                return null;
            }
        }
        return null;
    }, [draftKey]);

    // Clear draft from localStorage
    const clearDraft = useCallback(() => {
        localStorage.removeItem(draftKey);
    }, [draftKey]);

    const markAutosavePending = useCallback(() => {
        hasPendingChangesRef.current = true;
        lastEditAtRef.current = Date.now();
        setAutosaveTrigger((prev) => prev + 1);
    }, []);

    const handleTitleChange = useCallback((value: string) => {
        setTitle(value);
        markAutosavePending();
    }, [markAutosavePending]);

    const handleEmojiChange = useCallback((value: string) => {
        setEmoji(value);
        markAutosavePending();
    }, [markAutosavePending]);

    const handleFolderChange = useCallback((value: string | null) => {
        setFolderId(value);
        markAutosavePending();
    }, [markAutosavePending]);

    const getSavePayload = useCallback(() => ({
        id: currentNoteIdRef.current || weblog?._id,
        title: title.trim() || "Untitled Note",
        content: getContent(),
        emoji,
        folderId: folderId || undefined,
        tags,
        isPinned: weblog?.isPinned,
        rawTranscript,
    }), [title, emoji, folderId, tags, rawTranscript, weblog?._id, weblog?.isPinned]);

    const runAutoSave = useCallback(async (options?: { force?: boolean }) => {
        const force = options?.force ?? false;
        if (isAutoSaving || isSaving) return false;
        if (!currentNoteIdRef.current && !hasMeaningfulContent()) return false;
        if (!force) {
            if (!hasPendingChangesRef.current) return false;
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;

            const now = Date.now();
            if (now - lastEditAtRef.current < AUTOSAVE_IDLE_MS) return false;
        }

        const payload = getSavePayload();
        const fingerprint = JSON.stringify(payload);
        if (fingerprint === lastAutoSavedFingerprintRef.current) return false;

        setIsAutoSaving(true);
        try {
            const savedId = await onSave(payload, true);

            if (!currentNoteIdRef.current && savedId) {
                const normalizedId = String(savedId);
                setCurrentNoteId(normalizedId);
                currentNoteIdRef.current = normalizedId;
                clearDraft();
            }

            lastAutoSavedFingerprintRef.current = JSON.stringify({
                ...payload,
                id: currentNoteIdRef.current || payload.id || undefined,
            });
            hasPendingChangesRef.current = false;
            setLastAutoSavedAt(Date.now());
            return true;
        } catch (error) {
            console.error("Auto-save to DB failed:", error);
            return false;
        } finally {
            setIsAutoSaving(false);
        }
    }, [isAutoSaving, isSaving, hasMeaningfulContent, getSavePayload, onSave, clearDraft]);

    // Reset state when opening - check for draft first
    useEffect(() => {
        if (isOpen) {
            const resolvedNoteId = weblog?._id ? String(weblog._id) : null;
            setCurrentNoteId(resolvedNoteId);
            currentNoteIdRef.current = resolvedNoteId;
            lastAutoSavedFingerprintRef.current = "";
            hasPendingChangesRef.current = false;
            lastEditAtRef.current = 0;
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }

            const draft = loadDraft();
            if (draft && !weblog) {
                // Load draft for new note
                setTitle(draft.title || "");
                setEmoji(draft.emoji || "📝");
                setFolderId(draft.folderId ?? initialFolderId ?? null);
                setTags(draft.tags || []);
                setRawTranscript(draft.rawTranscript);
                setTimeout(() => {
                    if (editorRef.current) {
                        editorRef.current.innerHTML = draft.content || "";
                    }
                }, 50);
            } else {
                // Load from weblog or defaults
                setTitle(weblog?.title || "");
                setEmoji(weblog?.emoji || "📝");
                setFolderId(weblog ? (weblog.folderId ?? null) : (initialFolderId ?? null));
                setTags(weblog?.tags || []);
                setRawTranscript(weblog?.rawTranscript);
                setTimeout(() => {
                    if (editorRef.current) {
                        editorRef.current.innerHTML = weblog?.content || "";
                    }
                }, 50);
            }
        }
    }, [isOpen, weblog, loadDraft, initialFolderId]);

    useEffect(() => {
        if (showTagInput && tagInputRef.current) {
            tagInputRef.current.focus();
        }
    }, [showTagInput]);

    // Debounced autosave schedule (triggered only by edits)
    useEffect(() => {
        if (!isOpen) return;
        if (!hasPendingChangesRef.current) return;

        // Keep local draft only for brand-new notes that do not yet have an id.
        if (!currentNoteIdRef.current) {
            saveDraft();
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        autosaveTimeoutRef.current = setTimeout(() => {
            void runAutoSave();
        }, AUTOSAVE_IDLE_MS);

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }
        };
    }, [isOpen, autosaveTrigger, saveDraft, runAutoSave]);

    const getContent = () => {
        return editorRef.current?.innerHTML || "";
    };

    // Handle close with warning
    const handleClose = useCallback(async () => {
        if (isProcessingAudioRef.current) {
            shouldSaveOnCompleteRef.current = true;
            onClose();
            return;
        }

        const noteExists = Boolean(currentNoteIdRef.current || weblog?._id);
        if (noteExists) {
            if (hasUnsavedChanges()) {
                await runAutoSave({ force: true });
            }
            clearDraft();
            onClose();
            return;
        }

        if (hasUnsavedChanges()) {
            saveDraft(); // Save before showing warning
            setShowCloseWarning(true);
        } else {
            clearDraft();
            onClose();
        }
    }, [hasUnsavedChanges, saveDraft, clearDraft, onClose, weblog?._id, runAutoSave]);

    // Discard draft and close
    const handleDiscardAndClose = useCallback(() => {
        if (isProcessingAudioRef.current) {
            shouldSaveOnCompleteRef.current = true;
            setShowCloseWarning(false);
            onClose();
            return;
        }
        clearDraft();
        setShowCloseWarning(false);
        onClose();
    }, [clearDraft, onClose]);

    // Keep draft and close
    const handleKeepDraftAndClose = useCallback(() => {
        saveDraft();
        setShowCloseWarning(false);
        onClose();
    }, [saveDraft, onClose]);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await onSave({
                id: currentNoteIdRef.current || weblog?._id,
                title: title.trim() || "Untitled Note",
                content: getContent(),
                emoji,
                folderId: folderId || undefined,
                tags,
                isPinned: weblog?.isPinned,
                rawTranscript
            });

            if (!currentNoteIdRef.current && !weblog?._id) {
                // Reset autosave fingerprint so new edits after initial create are detected correctly.
                lastAutoSavedFingerprintRef.current = "";
            }

            clearDraft(); // Clear draft on successful save
            onClose();
        } catch (error) {
            console.error("Failed to save note:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Format commands for rich text
    const execCommand = useCallback((command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        updateActiveFormats();
    }, [updateActiveFormats]);

    // Floating Toolbar State
    const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const updatePosition = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !editorRef.current) {
                setFloatingToolbarPos(null);
                return;
            }

            const range = selection.getRangeAt(0);

            // Check if selection is inside editor
            if (!editorRef.current.contains(selection.anchorNode)) {
                setFloatingToolbarPos(null);
                return;
            }

            const container = editorRef.current.parentElement;
            if (!container) return;

            const rect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Estimated dimensions of the toolbar
            const toolbarHeight = 50;
            const toolbarWidth = 280; // Estimate
            const halfWidth = toolbarWidth / 2;

            // Calculate horizontal position (centered relative to selection, but clamped)
            let left = rect.left - containerRect.left + (rect.width / 2);

            // Clamp horizontal position to keep within container
            if (left < halfWidth) left = halfWidth;
            if (left > containerRect.width - halfWidth) left = containerRect.width - halfWidth;

            // Calculate vertical position (prefer below)
            const gap = 10;
            let top = rect.bottom - containerRect.top + container.scrollTop + gap;

            // Check if it fits below the visible area
            const visibleBottom = container.scrollTop + container.clientHeight;

            // If the toolbar bottom goes beyond visible bottom, try above
            if (top + toolbarHeight > visibleBottom) {
                const topAbove = rect.top - containerRect.top + container.scrollTop - toolbarHeight - gap;
                // Only use above if it fits within the top boundary
                if (topAbove >= container.scrollTop) {
                    top = topAbove;
                }
            }

            setFloatingToolbarPos({
                top,
                left
            });
        };

        document.addEventListener('selectionchange', updatePosition);
        // Also update on scroll
        const container = editorRef.current?.parentElement;
        if (container) {
            container.addEventListener('scroll', updatePosition);
        }

        return () => {
            document.removeEventListener('selectionchange', updatePosition);
            if (container) {
                container.removeEventListener('scroll', updatePosition);
            }
        };
    }, [editorRef]);

    // Check if current selection is inside a specific block type
    const isInsideBlock = useCallback((tagName: string): boolean => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
            if (node.nodeName.toLowerCase() === tagName.toLowerCase()) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }, []);

    // Get the parent block element of current selection
    const getParentBlock = useCallback((): HTMLElement | null => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tagName = el.tagName.toLowerCase();
                if (['h1', 'h2', 'h3', 'p', 'div', 'blockquote'].includes(tagName)) {
                    return el;
                }
            }
            node = node.parentNode;
        }
        return null;
    }, []);

    const formatBold = () => execCommand("bold");
    const formatItalic = () => execCommand("italic");
    const formatUnderline = () => execCommand("underline");
    const formatStrikethrough = () => execCommand("strikeThrough");
    const formatCode = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const text = selection.toString();
            if (text) {
                // Check if already in code tag
                let node: Node | null = selection.anchorNode;
                while (node && node !== editorRef.current) {
                    if (node.nodeName.toLowerCase() === 'code') {
                        // Remove code formatting - replace with text content
                        const codeEl = node as HTMLElement;
                        const textNode = document.createTextNode(codeEl.textContent || '');
                        codeEl.parentNode?.replaceChild(textNode, codeEl);
                        editorRef.current?.focus();
                        return;
                    }
                    node = node.parentNode;
                }
                execCommand("insertHTML", `<code class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">${text}</code>`);
            }
        }
    };
    
    // Toggle heading - if already this heading, convert to paragraph
    const formatHeading = (level: number) => {
        const tagName = `h${level}`;
        if (isInsideBlock(tagName)) {
            execCommand("formatBlock", "div");
        } else {
            execCommand("formatBlock", tagName);
        }
    };
    
    // Convert to normal paragraph/div
    const formatParagraph = () => {
        execCommand("formatBlock", "div");
    };
    
    // Toggle blockquote
    const formatQuote = () => {
        if (isInsideBlock("blockquote")) {
            // Remove blockquote - need to unwrap
            const parentBlock = getParentBlock();
            if (parentBlock && parentBlock.tagName.toLowerCase() === 'blockquote') {
                const div = document.createElement('div');
                div.innerHTML = parentBlock.innerHTML;
                parentBlock.parentNode?.replaceChild(div, parentBlock);
                editorRef.current?.focus();
            } else {
                execCommand("formatBlock", "div");
            }
        } else {
            execCommand("formatBlock", "blockquote");
        }
    };
    
    // Toggle lists
    const formatBulletList = () => execCommand("insertUnorderedList");
    const formatNumberedList = () => execCommand("insertOrderedList");
    
    const formatCheckList = () => {
        execCommand("insertHTML", `<div class="flex items-start gap-2 my-1"><input type="checkbox" class="mt-1 w-4 h-4 rounded" /><span>Task item</span></div>`);
    };
    const insertLink = () => {
        const url = prompt("Enter URL:");
        if (url) {
            execCommand("createLink", url);
        }
    };
    const insertImage = () => {
        const url = prompt("Enter image URL:");
        if (url) {
            execCommand("insertImage", url);
        }
    };
    const undo = () => execCommand("undo");
    const redo = () => execCommand("redo");

    // Tag management
    const addTag = (tag: string) => {
        const trimmedTag = tag.trim().toLowerCase();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            setTags([...tags, trimmedTag]);
            markAutosavePending();
        }
        setNewTag("");
        setShowTagInput(false);
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
        markAutosavePending();
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag(newTag);
        } else if (e.key === "Escape") {
            setShowTagInput(false);
            setNewTag("");
        }
    };

    // Export functions
    const exportAsMarkdown = () => {
        const content = getContent();
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || "";
        
        const markdown = `# ${title}\n\n${textContent}`;
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title || "note"}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportAsPDF = async () => {
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                    
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    
                    body { 
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
                        min-height: 100vh;
                        padding: 0;
                        margin: 0;
                        color: #334155;
                    }
                    
                    .note-container {
                        width: 100%;
                        max-width: 100%;
                        margin: 0;
                        background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(254,250,224,0.95) 100%);
                        min-height: 100vh;
                        border: none;
                        border-radius: 0;
                        box-shadow: none;
                    }
                    
                    .note-header {
                        padding: 32px 48px;
                        background: rgba(255,255,255,0.8);
                        border-bottom: 3px solid rgba(226,232,240,0.6);
                        display: flex;
                        align-items: center;
                        gap: 20px;
                    }
                    
                    .note-emoji {
                        font-size: 3rem;
                        background: #fef3c7;
                        width: 80px;
                        height: 80px;
                        border-radius: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 3px solid #fcd34d;
                    }
                    
                    .note-title-section {
                        flex: 1;
                    }
                    
                    .note-title {
                        font-size: 2.25rem;
                        font-weight: 900;
                        color: #0f172a;
                        margin-bottom: 8px;
                    }
                    
                    .note-meta {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }
                    
                    .category-badge {
                        background: #1e293b;
                        color: white;
                        padding: 6px 16px;
                        border-radius: 20px;
                        font-size: 0.8rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    
                    .date-text {
                        color: #64748b;
                        font-size: 0.9rem;
                        font-weight: 500;
                    }
                    
                    .note-content {
                        padding: 48px;
                        line-height: 1.9;
                        font-size: 1.1rem;
                        color: #334155;
                    }
                    
                    .note-content h1 {
                        font-size: 2rem;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 32px 0 16px 0;
                    }
                    
                    .note-content h2 {
                        font-size: 1.625rem;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 28px 0 14px 0;
                    }
                    
                    .note-content h3 {
                        font-size: 1.375rem;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 24px 0 12px 0;
                    }
                    
                    .note-content p {
                        margin: 16px 0;
                    }
                    
                    .note-content blockquote {
                        border-left: 5px solid #f59e0b;
                        background: linear-gradient(90deg, rgba(251,191,36,0.15) 0%, transparent 100%);
                        padding: 20px 24px;
                        margin: 20px 0;
                        border-radius: 0 16px 16px 0;
                        font-style: italic;
                        color: #57534e;
                    }
                    
                    .note-content code {
                        background: #f1f5f9;
                        padding: 4px 10px;
                        border-radius: 8px;
                        font-size: 0.9em;
                        font-family: 'SF Mono', 'Fira Code', monospace;
                        color: #0f172a;
                        border: 1px solid #e2e8f0;
                    }
                    
                    .note-content pre {
                        background: #1e293b;
                        color: #e2e8f0;
                        padding: 24px;
                        border-radius: 16px;
                        overflow-x: auto;
                        margin: 20px 0;
                        font-family: 'SF Mono', 'Fira Code', monospace;
                        font-size: 0.95rem;
                        line-height: 1.7;
                    }
                    
                    .note-content pre code {
                        background: transparent;
                        padding: 0;
                        border: none;
                        color: inherit;
                    }
                    
                    .note-content ul, .note-content ol {
                        margin: 16px 0;
                        padding-left: 32px;
                    }
                    
                    .note-content li {
                        margin: 8px 0;
                    }
                    
                    .note-content ul li::marker {
                        color: #f59e0b;
                    }
                    
                    .note-content ol li::marker {
                        color: #f59e0b;
                        font-weight: 700;
                    }
                    
                    .note-content a {
                        color: #2563eb;
                        text-decoration: none;
                        border-bottom: 2px solid #93c5fd;
                    }
                    
                    .note-content img {
                        max-width: 100%;
                        border-radius: 16px;
                        margin: 20px 0;
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    }
                    
                    .note-content strong, .note-content b {
                        font-weight: 700;
                        color: #0f172a;
                    }
                    
                    .note-content em, .note-content i {
                        font-style: italic;
                    }
                    
                    .note-content u {
                        text-decoration: underline;
                        text-decoration-color: #f59e0b;
                        text-underline-offset: 4px;
                    }
                    
                    .note-content s, .note-content strike {
                        text-decoration: line-through;
                        color: #94a3b8;
                    }
                    
                    .note-footer {
                        padding: 24px 48px;
                        background: rgba(255,255,255,0.6);
                        border-top: 3px solid rgba(226,232,240,0.6);
                    }
                    
                    .tags-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    
                    .tag {
                        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                        color: #92400e;
                        padding: 8px 18px;
                        border-radius: 24px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        border: 2px solid #fcd34d;
                    }
                    
                    @media print {
                        body {
                            background: white;
                            padding: 0;
                            margin: 0;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .note-container {
                            width: 100%;
                            max-width: 100%;
                            background: white;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="note-container">
                    <div class="note-header">
                        <div class="note-emoji">${emoji}</div>
                        <div class="note-title-section">
                            <div class="note-title">${title || "Untitled Note"}</div>
                            <div class="note-meta">
                                <span class="category-badge">${folders.find(f => f._id === folderId)?.name || "Note"}</span>
                                <span class="date-text">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                    <div class="note-content">
                        ${getContent()}
                    </div>
                    ${tags.length > 0 ? `
                    <div class="note-footer">
                        <div class="tags-container">
                            ${tags.map(t => `<span class="tag">#${t}</span>`).join("")}
                        </div>
                    </div>
                    ` : ""}
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "b") {
                e.preventDefault();
                formatBold();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "i") {
                e.preventDefault();
                formatItalic();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "u") {
                e.preventDefault();
                formatUnderline();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, title, emoji, folderId, tags]);

    const suggestedTags = existingTags.filter(t => !tags.includes(t) && t.toLowerCase().includes(newTag.toLowerCase()));
    const isSaveBusy = isSaving || isAutoSaving;
    const saveButtonLabel = isSaving
        ? "Saving..."
        : isAutoSaving
            ? "Auto-saving..."
            : lastAutoSavedAt
                ? "Saved"
                : "Save";

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent hideCloseButton className={cn(
                "p-0 gap-0 overflow-hidden flex flex-col shadow-2xl bg-[#FEFAE0] dark:bg-yellow-950/30",
                isFullscreen 
                    ? "!w-screen !h-[100dvh] !max-w-none !max-h-none !rounded-none !border-0 !top-0 !left-0 !translate-x-0 !translate-y-0" 
                    : "max-w-4xl w-[95vw] md:w-full h-[90vh] md:h-[85vh] rounded-2xl md:rounded-3xl border-2 md:border-4 border-slate-200"
            )}>
                {/* Visually hidden title for screen readers */}
                <DialogTitle className="sr-only">
                    {weblog ? `Edit Note: ${weblog.title || 'Untitled'}` : 'Create New Note'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Editor for creating and editing markdown and audio notes.
                </DialogDescription>

                {/* Mobile Header */}
                <div className="flex md:hidden items-center justify-between p-3 border-b-2 border-slate-200/50 bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="shrink-0 scale-75 origin-left -mr-2">
                            <CompactIconPicker
                                selectedIcon={emoji}
                                onSelectIcon={handleEmojiChange}
                                selectedColor={DEFAULT_ICON_COLOR}
                                onSelectColor={() => {}}
                                colors={ICON_COLORS}
                            />
                        </div>
                        <Input
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Note Title..."
                            className="border-none shadow-none text-base font-bold bg-transparent p-0 h-7 focus-visible:ring-0 placeholder:text-slate-400 min-w-0 flex-1"
                        />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="text-slate-400 h-8 w-8"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaveBusy}
                            size="sm"
                            className={cn(
                                "text-white font-bold rounded-lg h-8 px-3 min-w-[88px]",
                                isSaveBusy ? "bg-green-500/90" : "bg-green-500 hover:bg-green-600"
                            )}
                        >
                            <span className="inline-flex items-center gap-1.5 text-xs">
                                {isSaveBusy ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : lastAutoSavedAt ? (
                                    <Check className="w-3.5 h-3.5" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                {saveButtonLabel}
                            </span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleClose} className="text-slate-400 h-8 w-8">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Desktop Header */}
                <div className="hidden md:flex items-center justify-between p-4 border-b-2 border-slate-200/50 bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 flex-1">
                        <CompactIconPicker
                            selectedIcon={emoji}
                            onSelectIcon={handleEmojiChange}
                            selectedColor={DEFAULT_ICON_COLOR}
                            onSelectColor={() => {}}
                            colors={ICON_COLORS}
                        />

                        <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="Note Title..."
                                    className="border-none shadow-none text-xl font-black bg-transparent p-0 h-8 focus-visible:ring-0 placeholder:text-slate-400 flex-1"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Folder:</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-1.5 h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-slate-800 text-white border-slate-800 hover:bg-slate-700 transition-all">
                                            {(() => {
                                                const f = folders.find(f => f._id === folderId);
                                                return f ? <><span className="text-xs leading-none">{f.icon}</span>{f.name}</> : <span>No Folder</span>;
                                            })()}
                                            <svg className="w-2.5 h-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="rounded-xl border-2 min-w-[160px] p-1">
                                        {folders.map(folder => (
                                            <DropdownMenuItem
                                                key={folder._id}
                                                onClick={() => handleFolderChange(folder._id)}
                                                className={cn(
                                                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer",
                                                    folderId === folder._id && "bg-slate-100 text-slate-900"
                                                )}
                                            >
                                                <span className="text-base leading-none">{folder.icon}</span>
                                                {folder.name}
                                                {folderId === folder._id && <svg className="w-3.5 h-3.5 ml-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="text-slate-400 hover:text-slate-600 rounded-xl"
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="font-bold rounded-xl border-2">
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl font-bold border-2">
                                <DropdownMenuItem onClick={exportAsMarkdown} className="cursor-pointer">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Markdown (.md)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={exportAsPDF} className="cursor-pointer">
                                    <FileText className="w-4 h-4 mr-2" />
                                    PDF (Print)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            onClick={handleSave}
                            disabled={isSaveBusy}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
                        >
                            {isSaveBusy ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : lastAutoSavedAt ? (
                                <Check className="w-4 h-4 mr-2" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {saveButtonLabel}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClose}
                            className="text-slate-400 hover:text-slate-600 rounded-xl"
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>
                </div>

                {/* Mobile Folder Picker */}
                <div className="md:hidden px-3 py-2 bg-white/30 border-b border-slate-200/50">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Folder:</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-slate-800 text-white border-slate-800 hover:bg-slate-700 transition-all">
                                    {(() => {
                                        const f = folders.find(f => f._id === folderId);
                                        return f ? <><span className="text-xs leading-none">{f.icon}</span>{f.name}</> : <span>No Folder</span>;
                                    })()}
                                    <svg className="w-2.5 h-2.5 opacity-70 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-xl border-2 min-w-[160px] p-1">
                                {folders.map(folder => (
                                    <DropdownMenuItem
                                        key={folder._id}
                                        onClick={() => handleFolderChange(folder._id)}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer",
                                            folderId === folder._id && "bg-slate-100 text-slate-900"
                                        )}
                                    >
                                        <span className="text-base leading-none">{folder.icon}</span>
                                        {folder.name}
                                        {folderId === folder._id && <svg className="w-3.5 h-3.5 ml-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Tags Section */}
                <div className="px-3 md:px-4 py-2 bg-white/30 border-b border-slate-200/50">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {tags.map(tag => (
                            <Badge
                                key={tag}
                                variant="secondary"
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-2 py-0.5 text-xs cursor-pointer"
                                onClick={() => removeTag(tag)}
                            >
                                #{tag}
                                <X className="w-3 h-3 ml-1" />
                            </Badge>
                        ))}
                        {showTagInput ? (
                            <div className="relative">
                                <Input
                                    ref={tagInputRef}
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            if (newTag.trim()) addTag(newTag);
                                            else setShowTagInput(false);
                                        }, 150);
                                    }}
                                    placeholder="Add tag..."
                                    className="h-6 w-24 text-xs border rounded-lg px-2 py-0"
                                />
                                {suggestedTags.length > 0 && newTag && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                                        {suggestedTags.slice(0, 5).map(tag => (
                                            <button
                                                key={tag}
                                                className="w-full text-left px-3 py-1 text-xs hover:bg-slate-100"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    addTag(tag);
                                                }}
                                            >
                                                #{tag}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowTagInput(true)}
                                className="flex items-center gap-1 h-6 px-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                <span className="hidden sm:inline">Add tag</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Formatting Toolbar */}
                <div className="px-2 md:px-4 py-2 bg-white/40 border-b border-slate-200/50 overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-0.5 md:gap-1 min-w-max">
                        <ToolbarButton onClick={undo} icon={<Undo className="w-4 h-4" />} tooltip="Undo" />
                        <ToolbarButton onClick={redo} icon={<Redo className="w-4 h-4" />} tooltip="Redo" />
                        
                        <div className="w-px h-5 bg-slate-200 mx-1 md:mx-2" />
                        
                        <button
                            onClick={startRecording}
                            disabled={isProcessingAudio || isRecording}
                            title="Record Audio Note"
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold text-xs md:text-sm shadow-sm border whitespace-nowrap",
                                "bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-600 hover:border-indigo-700",
                                (isProcessingAudio || isRecording) && "opacity-50 cursor-not-allowed bg-slate-400 border-slate-500"
                            )}
                        >
                            {isProcessingAudio ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Analyzing...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Mic className="w-4 h-4" />
                                    <span>Record Note</span>
                                </div>
                            )}
                        </button>
                        
                        {rawTranscript && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRawTranscript(!showRawTranscript)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 h-8 rounded-lg font-bold text-xs transition-all",
                                    showRawTranscript 
                                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" 
                                        : "text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                {showRawTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {showRawTranscript ? "Hide Transcript" : "View Transcript"}
                            </Button>
                        )}
                        
                        <div className="w-px h-5 bg-slate-200 mx-1 md:mx-2" />
                        
                        <ToolbarButton onClick={formatBold} icon={<Bold className="w-4 h-4" />} tooltip="Bold (Ctrl+B)" active={activeFormats.bold} />
                        <ToolbarButton onClick={formatItalic} icon={<Italic className="w-4 h-4" />} tooltip="Italic (Ctrl+I)" active={activeFormats.italic} />
                        <ToolbarButton onClick={formatUnderline} icon={<Underline className="w-4 h-4" />} tooltip="Underline (Ctrl+U)" active={activeFormats.underline} />
                        <ToolbarButton onClick={formatStrikethrough} icon={<Strikethrough className="w-4 h-4" />} tooltip="Strikethrough" active={activeFormats.strikethrough} />
                        <ToolbarButton onClick={formatCode} icon={<Code className="w-4 h-4" />} tooltip="Inline Code" active={activeFormats.code} />
                        
                        <div className="w-px h-5 bg-slate-200 mx-1 md:mx-2" />
                        
                        <ToolbarButton onClick={() => formatHeading(1)} icon={<Heading1 className="w-4 h-4" />} tooltip="Heading 1 (toggle)" active={activeFormats.h1} />
                        <ToolbarButton onClick={() => formatHeading(2)} icon={<Heading2 className="w-4 h-4" />} tooltip="Heading 2 (toggle)" active={activeFormats.h2} />
                        <ToolbarButton onClick={() => formatHeading(3)} icon={<Heading3 className="w-4 h-4" />} tooltip="Heading 3 (toggle)" active={activeFormats.h3} />
                        <ToolbarButton onClick={formatParagraph} icon={<span className="text-sm font-bold">¶</span>} tooltip="Normal Text" />
                        
                        <div className="w-px h-5 bg-slate-200 mx-1 md:mx-2" />
                        
                        <ToolbarButton onClick={formatBulletList} icon={<List className="w-4 h-4" />} tooltip="Bullet List (toggle)" active={activeFormats.ul} />
                        <ToolbarButton onClick={formatNumberedList} icon={<ListOrdered className="w-4 h-4" />} tooltip="Numbered List (toggle)" active={activeFormats.ol} />
                        <ToolbarButton onClick={formatCheckList} icon={<CheckSquare className="w-4 h-4" />} tooltip="Checklist" />
                        <ToolbarButton onClick={formatQuote} icon={<Quote className="w-4 h-4" />} tooltip="Quote (toggle)" active={activeFormats.blockquote} />
                        
                        <div className="w-px h-5 bg-slate-200 mx-1 md:mx-2" />
                        
                        <ToolbarButton onClick={insertLink} icon={<LinkIcon className="w-4 h-4" />} tooltip="Insert Link" />
                        <ToolbarButton onClick={insertImage} icon={<ImageIcon className="w-4 h-4" />} tooltip="Insert Image" />

                        {/* Mobile Export */}
                        <div className="md:hidden ml-auto">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                                        <Download className="w-4 h-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl font-bold border-2">
                                    <DropdownMenuItem onClick={exportAsMarkdown} className="cursor-pointer">
                                        <FileText className="w-4 h-4 mr-2" />
                                        Markdown
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportAsPDF} className="cursor-pointer">
                                        <FileText className="w-4 h-4 mr-2" />
                                        PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* Rich Text Editor - WYSIWYG */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white/40 dark:bg-black/20 custom-scrollbar relative">
                    {/* Raw Transcript View */}
                    {showRawTranscript && rawTranscript && (
                        <div className="mb-6 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/20 border-2 border-indigo-100/50 dark:border-indigo-800/30 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Mic className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Raw Transcription</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                "{rawTranscript}"
                            </p>
                        </div>
                    )}

                    {/* Floating Toolbar */}
                    {floatingToolbarPos && (
                        <div
                            className="absolute z-50 flex items-center gap-1 p-1.5 bg-slate-900 text-white rounded-xl shadow-xl -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                            style={{
                                top: floatingToolbarPos.top,
                                left: floatingToolbarPos.left
                            }}
                            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                        >
                            <ToolbarButton
                                onClick={formatBold}
                                icon={<Bold className="w-4 h-4" />}
                                tooltip="Bold"
                                active={activeFormats.bold}
                                className={activeFormats.bold ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
                            />
                            <ToolbarButton
                                onClick={formatItalic}
                                icon={<Italic className="w-4 h-4" />}
                                tooltip="Italic"
                                active={activeFormats.italic}
                                className={activeFormats.italic ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
                            />
                            <ToolbarButton
                                onClick={formatUnderline}
                                icon={<Underline className="w-4 h-4" />}
                                tooltip="Underline"
                                active={activeFormats.underline}
                                className={activeFormats.underline ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
                            />
                            <ToolbarButton
                                onClick={formatStrikethrough}
                                icon={<Strikethrough className="w-4 h-4" />}
                                tooltip="Strikethrough"
                                active={activeFormats.strikethrough}
                                className={activeFormats.strikethrough ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
                            />
                            <div className="w-px h-4 bg-slate-700 mx-1" />
                            <ToolbarButton
                                onClick={formatCode}
                                icon={<Code className="w-4 h-4" />}
                                tooltip="Code"
                                active={activeFormats.code}
                                className={activeFormats.code ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
                            />
                            <ToolbarButton
                                onClick={insertLink}
                                icon={<LinkIcon className="w-4 h-4" />}
                                tooltip="Link"
                                className="text-slate-300 hover:bg-slate-800 hover:text-white"
                            />
                        </div>
                    )}

                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={markAutosavePending}
                        onSelect={updateActiveFormats}
                        onKeyUp={updateActiveFormats}
                        onClick={updateActiveFormats}
                        className={cn(
                            "min-h-full outline-none whitespace-pre-wrap break-words",
                            "text-base md:text-lg leading-relaxed text-slate-700 dark:text-slate-200",
                            "caret-slate-800 dark:caret-white",
                            "[&>h1]:text-2xl [&>h1]:md:text-3xl [&>h1]:font-black [&>h1]:mt-6 [&>h1]:mb-3 [&>h1]:text-slate-900 [&>h1]:dark:text-white",
                            "[&>h2]:text-xl [&>h2]:md:text-2xl [&>h2]:font-bold [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:text-slate-800 [&>h2]:dark:text-slate-100",
                            "[&>h3]:text-lg [&>h3]:md:text-xl [&>h3]:font-bold [&>h3]:mt-4 [&>h3]:mb-2 [&>h3]:text-slate-800 [&>h3]:dark:text-slate-100",
                            "[&>p]:my-2 [&>p]:leading-relaxed",
                            "[&>div]:my-1 [&>div]:leading-relaxed",
                            "[&_a]:text-blue-500 [&_a]:underline hover:[&_a]:text-blue-600",
                            "[&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:max-w-full [&_img]:my-4",
                            "[&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_blockquote]:dark:text-slate-400",
                            "[&_code]:bg-slate-100 [&_code]:dark:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono",
                            "[&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc",
                            "[&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal",
                            "[&_li]:my-1 [&_li]:leading-relaxed",
                            "[&_b]:font-bold [&_strong]:font-bold",
                            "[&_i]:italic [&_em]:italic",
                            "[&_u]:underline",
                            "[&_s]:line-through [&_strike]:line-through",
                            "[&_input[type=checkbox]]:w-4 [&_input[type=checkbox]]:h-4 [&_input[type=checkbox]]:rounded [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-green-500",
                            "focus:outline-none",
                            "empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
                        )}
                        style={{ minHeight: "200px" }}
                        data-placeholder="Start writing your note..."
                        suppressContentEditableWarning
                        onKeyDown={(e) => {
                            if (e.key === "Tab") {
                                e.preventDefault();
                                document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
                            }
                        }}
                        onPaste={(e) => {
                            // Handle paste to strip HTML formatting if needed
                            e.preventDefault();
                            const text = e.clipboardData.getData("text/plain");
                            document.execCommand("insertText", false, text);
                        }}
                        onFocus={() => {
                            // Ensure default paragraph mode
                            document.execCommand("defaultParagraphSeparator", false, "div");
                        }}
                    />
                </div>

            </DialogContent>
        </Dialog>

        {/* Recording Modal */}
        <Dialog open={isRecordingModalOpen} onOpenChange={(open) => !open && stopRecording()}>
            <DialogContent hideCloseButton className="max-w-sm w-[90vw] p-0 overflow-hidden rounded-3xl border-4 border-indigo-100 shadow-2xl bg-white">
                <DialogTitle className="sr-only">Recording Audio Note</DialogTitle>
                <DialogDescription className="sr-only">
                    Capturing audio for transcription and AI analysis.
                </DialogDescription>
                <div className="flex flex-col items-center p-8 gap-6">
                    <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center relative transition-all duration-300",
                        isPaused ? "bg-slate-100 scale-95" : "bg-red-50 scale-100"
                    )}>
                        {!isPaused && <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />}
                        <Mic className={cn(
                            "w-10 h-10 relative z-10 transition-colors duration-300",
                            isPaused ? "text-slate-400" : "text-red-500"
                        )} />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-black text-slate-800 tabular-nums">
                            {formatTime(recordingTime)}
                        </span>
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300",
                            isPaused ? "text-amber-500" : "text-red-500 animate-pulse"
                        )}>
                            {isPaused ? "Paused" : "Recording..."}
                        </span>
                    </div>

                    <div className="w-full h-24 bg-slate-50 rounded-2xl border-2 border-slate-100 overflow-hidden relative">
                        <canvas 
                            ref={canvasRef} 
                            width={300} 
                            height={100} 
                            className="w-full h-full"
                        />
                    </div>

                    <div className="flex gap-3 w-full">
                        <Button
                            onClick={isPaused ? resumeRecording : pauseRecording}
                            className={cn(
                                "flex-1 h-14 font-black text-base rounded-2xl border-b-4 transition-all flex items-center justify-center gap-2",
                                isPaused 
                                    ? "bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-700 active:border-b-0 active:translate-y-1" 
                                    : "bg-amber-400 hover:bg-amber-500 text-slate-900 border-amber-600 active:border-b-0 active:translate-y-1"
                            )}
                        >
                            {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                            {isPaused ? "Resume" : "Pause"}
                        </Button>
                        <Button
                            onClick={stopRecording}
                            className="flex-1 h-14 bg-red-500 hover:bg-red-600 text-white font-black text-base rounded-2xl border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            <Square className="w-5 h-5 fill-current" />
                            Stop
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Close warning dialog */}
        <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
            <AlertDialogContent className="rounded-2xl border-2">
                <AlertDialogHeader>
                    <AlertDialogTitle className="font-black">Unsaved Changes</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isProcessingAudio ? 
                            "Your audio note is currently being analyzed by AI. You can close this editor and the note will be automatically saved in the background once processing is complete." :
                            "You have unsaved changes. Your draft has been saved and will be restored when you reopen the editor. Do you want to keep the draft or discard it?"
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    {isProcessingAudio ? (
                        <AlertDialogAction 
                            onClick={handleDiscardAndClose}
                            className="rounded-xl font-bold bg-indigo-500 hover:bg-indigo-600 text-white"
                        >
                            Save in Background & Close
                        </AlertDialogAction>
                    ) : (
                        <>
                            <AlertDialogCancel 
                                onClick={handleDiscardAndClose}
                                className="rounded-xl font-bold border-2 text-red-500 border-red-200 hover:bg-red-50"
                            >
                                Discard Draft
                            </AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handleKeepDraftAndClose}
                                className="rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white"
                            >
                                Keep Draft
                            </AlertDialogAction>
                        </>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

function ToolbarButton({ 
    onClick, 
    icon, 
    tooltip, 
    active = false,
    className
}: { 
    onClick: () => void; 
    icon: React.ReactNode; 
    tooltip: string; 
    active?: boolean;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            className={cn(
                "p-1.5 md:p-2 rounded-lg transition-colors",
                active 
                    ? "bg-slate-200 text-slate-800" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
                className
            )}
        >
            {icon}
        </button>
    );
}
