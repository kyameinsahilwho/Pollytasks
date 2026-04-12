import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all weblogs for the current user
export const list = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        const weblogs = await ctx.db
            .query("weblogs")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        // Sort by pinned status (true first) then by updatedAt (newest first)
        return weblogs.sort((a, b) => {
            if (a.isPinned === b.isPinned) {
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            }
            return (a.isPinned ? -1 : 1);
        });
    },
});

// Create a new weblog
export const create = mutation({
    args: {
        title: v.string(),
        content: v.string(),
        emoji: v.optional(v.string()),
        category: v.optional(v.string()),
        color: v.optional(v.string()),
        isPinned: v.optional(v.boolean()),
        folderId: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        rawTranscript: v.optional(v.string()),
        audioStorageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        const now = new Date().toISOString();

        const weblogId = await ctx.db.insert("weblogs", {
            userId: user._id,
            title: args.title,
            content: args.content,
            emoji: args.emoji || "📝",
            category: args.category || "personal",
            color: args.color || "yellow",
            isPinned: args.isPinned || false,
            folderId: args.folderId,
            tags: args.tags || [],
            rawTranscript: args.rawTranscript,
            audioStorageId: args.audioStorageId,
            createdAt: now,
            updatedAt: now,
        });

        return weblogId;
    },
});

// Update a weblog
export const update = mutation({
    args: {
        id: v.id("weblogs"),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
        emoji: v.optional(v.string()),
        category: v.optional(v.string()),
        color: v.optional(v.string()),
        isPinned: v.optional(v.boolean()),
        folderId: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        rawTranscript: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const { id, ...updates } = args;
        const now = new Date().toISOString();

        await ctx.db.patch(id, {
            ...updates,
            updatedAt: now,
        });
    },
});

// Delete a weblog
export const deleteWeblog = mutation({
    args: { id: v.id("weblogs") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        await ctx.db.delete(args.id);
    },
});

// Toggle pin status
export const togglePin = mutation({
    args: { id: v.id("weblogs") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const weblog = await ctx.db.get(args.id);
        if (!weblog) throw new Error("Weblog not found");

        const now = new Date().toISOString();

        await ctx.db.patch(args.id, {
            isPinned: !weblog.isPinned,
            updatedAt: now,
        });
    },
});

// Get all unique tags for the current user
export const getAllTags = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        const weblogs = await ctx.db
            .query("weblogs")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        // Extract all unique tags
        const allTags = new Set<string>();
        weblogs.forEach(weblog => {
            if (weblog.tags) {
                weblog.tags.forEach(tag => allTags.add(tag));
            }
        });

        return Array.from(allTags).sort();
    },
});

// ==================== FOLDERS ====================

// Get all folders for user
export const listFolders = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        return await ctx.db
            .query("weblogFolders")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();
    },
});

export const createFolder = mutation({
    args: {
        name: v.string(),
        icon: v.string(),
        color: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) =>
                q.eq("tokenIdentifier", identity.tokenIdentifier)
            )
            .unique();

        if (!user) throw new Error("User not found");

        const now = new Date().toISOString();

        return await ctx.db.insert("weblogFolders", {
            userId: user._id,
            name: args.name,
            icon: args.icon,
            color: args.color,
            createdAt: now,
        });
    },
});

export const updateFolder = mutation({
    args: {
        id: v.id("weblogFolders"),
        name: v.optional(v.string()),
        icon: v.optional(v.string()),
        color: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const { id, ...updates } = args;
        await ctx.db.patch(id, updates);
    },
});

export const deleteFolder = mutation({
    args: { id: v.id("weblogFolders") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        // Could optionally nullify folderId on associated weblogs here
        // but simple delete is fine for now
        await ctx.db.delete(args.id);
    },
});
