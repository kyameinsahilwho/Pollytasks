"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

export type WeblogFolder = {
    _id: Id<"weblogFolders"> | string;
    _creationTime: number;
    userId?: Id<"users"> | string;
    name: string;
    icon: string;
    color: string;
    createdAt: string;
};

// Local type for localStorage
type LocalWeblogFolder = Omit<WeblogFolder, '_id' | 'userId'> & {
    _id: string;
    userId?: string;
};

const CACHE_KEY_FOLDERS = 'pollytasks_cache_weblog_folders';
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
        console.error("Failed to cache weblog folders data:", e);
    }
}

export function useWeblogFolders(initialFolders?: Doc<"weblogFolders">[]) {
    const { isAuthenticated: _realIsAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
    const [forceLocal, setForceLocal] = useState(false);

    const isAuthenticated = _realIsAuthenticated && !forceLocal;

    const rawFolders = useQuery(api.weblogs.listFolders, isAuthenticated ? {} : "skip");

    const createFolderMutation = useMutation(api.weblogs.createFolder);
    const updateFolderMutation = useMutation(api.weblogs.updateFolder);
    const deleteFolderMutation = useMutation(api.weblogs.deleteFolder);

    // Local State
    const [localFolders, setLocalFolders] = useState<LocalWeblogFolder[]>([]);
    const [isLocalLoaded, setIsLocalLoaded] = useState(false);

    // Cached data
    const [cachedFolders] = useState<WeblogFolder[] | null>(() => getCachedData<WeblogFolder[]>(CACHE_KEY_FOLDERS));

    // Load from LocalStorage
    useEffect(() => {
        if (!isAuthenticated && !isAuthLoading && !isLocalLoaded) {
            try {
                const storedFolders = localStorage.getItem('pollytasks_weblog_folders');
                if (storedFolders) {
                    setLocalFolders(JSON.parse(storedFolders));
                }
            } catch (e) {
                console.error("Failed to load local folders", e);
            } finally {
                setIsLocalLoaded(true);
            }
        }
    }, [isAuthenticated, isAuthLoading, isLocalLoaded]);

    // Save to LocalStorage
    useEffect(() => {
        if (!isAuthenticated && !isAuthLoading && isLocalLoaded) {
            localStorage.setItem('pollytasks_weblog_folders', JSON.stringify(localFolders));
        }
    }, [localFolders, isAuthenticated, isAuthLoading, isLocalLoaded]);

    const folders: WeblogFolder[] = useMemo(() => {
        if (isAuthenticated) {
            if (!rawFolders) {
                return (initialFolders !== undefined ? initialFolders as unknown as WeblogFolder[] : cachedFolders) ?? [];
            }
            return rawFolders;
        } else {
            return localFolders as WeblogFolder[];
        }
    }, [rawFolders, isAuthenticated, localFolders, cachedFolders, initialFolders]);

    useEffect(() => {
        if (isAuthenticated && rawFolders !== undefined) {
            setCachedData(CACHE_KEY_FOLDERS, rawFolders);
        }
    }, [rawFolders, isAuthenticated]);

    const addFolder = useCallback(async (folderData: {
        name: string;
        icon: string;
        color: string;
    }) => {
        if (isAuthenticated) {
            return await createFolderMutation(folderData);
        } else {
            const now = new Date().toISOString();
            const newFolder: LocalWeblogFolder = {
                _id: `local-folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                _creationTime: Date.now(),
                name: folderData.name,
                icon: folderData.icon,
                color: folderData.color,
                createdAt: now,
            };
            setLocalFolders(prev => [newFolder, ...prev]);
            return newFolder._id;
        }
    }, [isAuthenticated, createFolderMutation]);

    const updateFolder = useCallback(async (id: Id<"weblogFolders"> | string, updates: Partial<WeblogFolder>) => {
        if (isAuthenticated) {
            return await updateFolderMutation({ id: id as Id<"weblogFolders">, ...updates });
        } else {
            setLocalFolders(prev => prev.map(f => {
                if (f._id === id) {
                    return { ...f, ...updates };
                }
                return f;
            }));
        }
    }, [isAuthenticated, updateFolderMutation]);

    const deleteFolder = useCallback(async (id: Id<"weblogFolders"> | string) => {
        if (isAuthenticated) {
            return await deleteFolderMutation({ id: id as Id<"weblogFolders"> });
        } else {
            setLocalFolders(prev => prev.filter(f => f._id !== id));
        }
    }, [isAuthenticated, deleteFolderMutation]);

    return {
        folders,
        addFolder,
        updateFolder,
        deleteFolder,
        isLoading: isAuthenticated ? (rawFolders === undefined && cachedFolders === null) : !isLocalLoaded,
    };
}
