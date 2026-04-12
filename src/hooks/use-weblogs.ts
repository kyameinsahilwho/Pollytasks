"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

export type Weblog = {
    _id: Id<"weblogs"> | string;
    _creationTime: number;
    userId?: Id<"users"> | string;
    title: string;
    content: string;
    rawTranscript?: string;
    audioStorageId?: string;
    emoji?: string;
    color?: string;
    isPinned?: boolean;
    category?: string;
    folderId?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
};

// Local weblog type for localStorage (uses string IDs)
type LocalWeblog = Omit<Weblog, '_id' | 'userId'> & {
    _id: string;
    userId?: string;
};

// Cache key for localStorage-first approach
const CACHE_KEY_WEBLOGS = 'pollytasks_cache_weblogs';

// Cache expiry in milliseconds (10 minutes)
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
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(cached));
    } catch (e) {
        console.error("Failed to cache weblogs data:", e);
    }
}

export function useWeblogs(initialWeblogs?: Doc<"weblogs">[]) {
    const { isAuthenticated: _realIsAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
    const [forceLocal, setForceLocal] = useState(false);

    const isAuthenticated = _realIsAuthenticated && !forceLocal;

    // Convex queries and mutations - use "skip" to conditionally skip queries
    const rawWeblogs = useQuery(api.weblogs.list, isAuthenticated ? {} : "skip");
    const rawAllTags = useQuery(api.weblogs.getAllTags, isAuthenticated ? {} : "skip");

    const createWeblogMutation = useMutation(api.weblogs.create);
    const updateWeblogMutation = useMutation(api.weblogs.update);
    const deleteWeblogMutation = useMutation(api.weblogs.deleteWeblog);
    const togglePinMutation = useMutation(api.weblogs.togglePin);

    // Local State (for unauthenticated users)
    const [localWeblogs, setLocalWeblogs] = useState<LocalWeblog[]>([]);
    const [isLocalLoaded, setIsLocalLoaded] = useState(false);

    // Cached data for localStorage-first approach (authenticated users)
    const [cachedWeblogs] = useState<Weblog[] | null>(() => getCachedData<Weblog[]>(CACHE_KEY_WEBLOGS));

    // Load from LocalStorage
    useEffect(() => {
        if (!isAuthenticated && !isAuthLoading && !isLocalLoaded) {
            try {
                const storedWeblogs = localStorage.getItem('pollytasks_weblogs');
                if (storedWeblogs) {
                    setLocalWeblogs(JSON.parse(storedWeblogs));
                }
            } catch (e) {
                console.error("Failed to load local weblogs", e);
            } finally {
                setIsLocalLoaded(true);
            }
        }
    }, [isAuthenticated, isAuthLoading, isLocalLoaded]);

    // Save to LocalStorage
    useEffect(() => {
        if (!isAuthenticated && !isAuthLoading && isLocalLoaded) {
            localStorage.setItem('pollytasks_weblogs', JSON.stringify(localWeblogs));
        }
    }, [localWeblogs, isAuthenticated, isAuthLoading, isLocalLoaded]);

    // Map data to consistent format
    const weblogs: Weblog[] = useMemo(() => {
        if (isAuthenticated) {
            // Use cached data while server data is loading (localStorage-first)
            if (!rawWeblogs) {
                return (initialWeblogs !== undefined ? initialWeblogs as unknown as Weblog[] : cachedWeblogs) ?? [];
            }
            return rawWeblogs;
        } else {
            return localWeblogs as Weblog[];
        }
    }, [rawWeblogs, isAuthenticated, localWeblogs, cachedWeblogs, initialWeblogs]);

    // Cache fresh weblogs data when received from server
    useEffect(() => {
        if (isAuthenticated && rawWeblogs !== undefined) {
            setCachedData(CACHE_KEY_WEBLOGS, rawWeblogs);
        }
    }, [rawWeblogs, isAuthenticated]);

    // Get all unique tags
    const allTags: string[] = useMemo(() => {
        if (isAuthenticated) {
            return rawAllTags || [];
        } else {
            const tagSet = new Set<string>();
            localWeblogs.forEach(w => {
                w.tags?.forEach(t => tagSet.add(t));
            });
            return Array.from(tagSet).sort();
        }
    }, [rawAllTags, isAuthenticated, localWeblogs]);

    const addWeblog = useCallback(async (weblogData: {
        title: string;
        content: string;
        emoji?: string;
        category?: string;
        folderId?: string;
        color?: string;
        isPinned?: boolean;
        tags?: string[];
        rawTranscript?: string;
        audioStorageId?: Id<"_storage"> | string;
    }) => {
        if (isAuthenticated) {
            return await createWeblogMutation(weblogData as any);
        } else {
            const now = new Date().toISOString();
            const newWeblog: LocalWeblog = {
                _id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                _creationTime: Date.now(),
                title: weblogData.title,
                content: weblogData.content,
                emoji: weblogData.emoji || "📝",
                category: weblogData.category || "personal",
                folderId: weblogData.folderId,
                color: weblogData.color,
                isPinned: weblogData.isPinned || false,
                tags: weblogData.tags || [],
                rawTranscript: weblogData.rawTranscript,
                audioStorageId: weblogData.audioStorageId,
                createdAt: now,
                updatedAt: now,
            };
            setLocalWeblogs(prev => [newWeblog, ...prev]);
            return newWeblog._id;
        }
    }, [isAuthenticated, createWeblogMutation]);

    const updateWeblog = useCallback(async (id: Id<"weblogs"> | string, updates: Partial<Weblog>) => {
        if (isAuthenticated) {
            // @ts-ignore - Convex types can be strict with ID fields
            return await updateWeblogMutation({ id, ...updates });
        } else {
            setLocalWeblogs(prev => prev.map(w => {
                if (w._id === id) {
                    return {
                        ...w,
                        ...updates,
                        updatedAt: new Date().toISOString(),
                    };
                }
                return w;
            }));
        }
    }, [isAuthenticated, updateWeblogMutation]);

    const deleteWeblog = useCallback(async (id: Id<"weblogs"> | string) => {
        if (isAuthenticated) {
            return await deleteWeblogMutation({ id: id as Id<"weblogs"> });
        } else {
            setLocalWeblogs(prev => prev.filter(w => w._id !== id));
        }
    }, [isAuthenticated, deleteWeblogMutation]);

    const togglePin = useCallback(async (id: Id<"weblogs"> | string) => {
        if (isAuthenticated) {
            return await togglePinMutation({ id: id as Id<"weblogs"> });
        } else {
            setLocalWeblogs(prev => prev.map(w => {
                if (w._id === id) {
                    return { ...w, isPinned: !w.isPinned };
                }
                return w;
            }));
        }
    }, [isAuthenticated, togglePinMutation]);

    return {
        weblogs,
        allTags,
        addWeblog,
        updateWeblog,
        deleteWeblog,
        togglePin,
        // isLoading is false if we have cached data (localStorage-first approach)
        isLoading: isAuthenticated ? (rawWeblogs === undefined && cachedWeblogs === null) : !isLocalLoaded,
    };
}
