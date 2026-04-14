import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./utils";

// ==================== FRIEND INVITES ====================

// Send a friend invite via email
export const sendFriendInvite = mutation({
    args: {
        toEmail: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        const user = await ctx.db.get(userId);
        if (!user) throw new Error("User not found");

        // Normalize email
        const toEmail = args.toEmail.toLowerCase().trim();

        // Can't invite yourself
        if (user.email?.toLowerCase() === toEmail) {
            throw new Error("You cannot invite yourself");
        }

        // Check if already friends
        const existingFriendByEmail = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", toEmail))
            .first();

        if (existingFriendByEmail) {
            const existingFriendship = await ctx.db
                .query("friendships")
                .withIndex("by_user_and_friend", (q) =>
                    q.eq("userId", userId).eq("friendId", existingFriendByEmail._id)
                )
                .first();

            if (existingFriendship) {
                throw new Error("You are already friends with this user");
            }
        }

        // Check for existing pending invite
        const existingInvite = await ctx.db
            .query("friendInvites")
            .withIndex("by_to_email", (q) => q.eq("toEmail", toEmail))
            .filter((q) =>
                q.and(
                    q.eq(q.field("fromUserId"), userId),
                    q.eq(q.field("status"), "pending")
                )
            )
            .first();

        if (existingInvite) {
            throw new Error("You already have a pending invite to this email");
        }

        // Generate unique invite code
        const inviteCode = crypto.randomUUID().split("-")[0].toUpperCase();
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        // Check if the invited email belongs to an existing user
        const existingUser = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", toEmail))
            .first();

        const inviteId = await ctx.db.insert("friendInvites", {
            fromUserId: userId,
            toEmail,
            toUserId: existingUser?._id,
            status: "pending",
            inviteCode,
            createdAt: now,
            expiresAt,
        });

        // If user exists, create a notification
        if (existingUser) {
            await ctx.db.insert("socialNotifications", {
                userId: existingUser._id,
                type: "friend_request",
                fromUserId: userId,
                referenceId: inviteId,
                referenceType: "friendInvite",
                message: `${user.name || 'Someone'} wants to be your accountability partner!`,
                seen: false,
                createdAt: now,
            });
        }

        return { inviteId, inviteCode };
    },
});

// Accept a friend invite
export const acceptFriendInvite = mutation({
    args: {
        inviteId: v.id("friendInvites"),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        const invite = await ctx.db.get(args.inviteId);
        if (!invite) throw new Error("Invite not found");

        if (invite.status !== "pending") {
            throw new Error("This invite is no longer valid");
        }

        // Check if invite is for this user
        const user = await ctx.db.get(userId);
        if (!user) throw new Error("User not found");

        if (invite.toEmail.toLowerCase() !== user.email?.toLowerCase() && invite.toUserId !== userId) {
            throw new Error("This invite is not for you");
        }

        const now = new Date().toISOString();

        // Update invite status
        await ctx.db.patch(args.inviteId, {
            status: "accepted",
            respondedAt: now,
            toUserId: userId,
        });

        // Create bidirectional friendship
        await ctx.db.insert("friendships", {
            userId: invite.fromUserId,
            friendId: userId,
            createdAt: now,
        });

        await ctx.db.insert("friendships", {
            userId: userId,
            friendId: invite.fromUserId,
            createdAt: now,
        });

        // Notify the sender
        const fromUser = await ctx.db.get(invite.fromUserId);
        await ctx.db.insert("socialNotifications", {
            userId: invite.fromUserId,
            type: "friend_accepted",
            fromUserId: userId,
            referenceId: args.inviteId,
            referenceType: "friendInvite",
            message: `${user.name || 'Someone'} accepted your friend request!`,
            seen: false,
            createdAt: now,
        });

        return { success: true };
    },
});

// Decline a friend invite
export const declineFriendInvite = mutation({
    args: {
        inviteId: v.id("friendInvites"),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        const invite = await ctx.db.get(args.inviteId);
        if (!invite) throw new Error("Invite not found");

        if (invite.toUserId !== userId) {
            throw new Error("This invite is not for you");
        }

        await ctx.db.patch(args.inviteId, {
            status: "declined",
            respondedAt: new Date().toISOString(),
        });

        return { success: true };
    },
});

// Accept invite by code (for new users or direct link)
export const acceptInviteByCode = mutation({
    args: {
        inviteCode: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        const invite = await ctx.db
            .query("friendInvites")
            .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode.toUpperCase()))
            .first();

        if (!invite) throw new Error("Invalid invite code");

        if (invite.status !== "pending") {
            throw new Error("This invite is no longer valid");
        }

        if (new Date(invite.expiresAt) < new Date()) {
            await ctx.db.patch(invite._id, { status: "expired" });
            throw new Error("This invite has expired");
        }

        if (invite.fromUserId === userId) {
            throw new Error("You cannot accept your own invite");
        }

        // Check if already friends
        const existingFriendship = await ctx.db
            .query("friendships")
            .withIndex("by_user_and_friend", (q) =>
                q.eq("userId", userId).eq("friendId", invite.fromUserId)
            )
            .first();

        if (existingFriendship) {
            throw new Error("You are already friends with this user");
        }

        const now = new Date().toISOString();

        // Update invite
        await ctx.db.patch(invite._id, {
            status: "accepted",
            respondedAt: now,
            toUserId: userId,
        });

        // Create friendships
        await ctx.db.insert("friendships", {
            userId: invite.fromUserId,
            friendId: userId,
            createdAt: now,
        });

        await ctx.db.insert("friendships", {
            userId: userId,
            friendId: invite.fromUserId,
            createdAt: now,
        });

        // Notify sender
        const user = await ctx.db.get(userId);
        await ctx.db.insert("socialNotifications", {
            userId: invite.fromUserId,
            type: "friend_accepted",
            fromUserId: userId,
            message: `${user?.name || 'Someone'} accepted your friend request!`,
            seen: false,
            createdAt: now,
        });

        return { success: true };
    },
});

// ==================== FRIENDS LIST ====================

// Get pending invites for current user
export const getPendingInvites = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getUserId(ctx);
        if (!userId) return [];

        const user = await ctx.db.get(userId);
        if (!user?.email) return [];

        const invites = await ctx.db
            .query("friendInvites")
            .withIndex("by_to_email", (q) => q.eq("toEmail", user.email!.toLowerCase()))
            .filter((q) => q.eq(q.field("status"), "pending"))
            .collect();

        // Enrich with sender info
        const enrichedInvites = await Promise.all(
            invites.map(async (invite) => {
                const fromUser = await ctx.db.get(invite.fromUserId);
                return {
                    ...invite,
                    fromUser: fromUser ? {
                        name: fromUser.name,
                        image: fromUser.image,
                        level: fromUser.level,
                    } : null,
                };
            })
        );

        return enrichedInvites;
    },
});

// Get sent invites
export const getSentInvites = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getUserId(ctx);
        if (!userId) return [];

        return await ctx.db
            .query("friendInvites")
            .withIndex("by_from_user", (q) => q.eq("fromUserId", userId))
            .order("desc")
            .take(20);
    },
});

// Get friends list
export const getFriends = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getUserId(ctx);
        if (!userId) return [];

        const friendships = await ctx.db
            .query("friendships")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        const friends = await Promise.all(
            friendships.map(async (friendship) => {
                const friend = await ctx.db.get(friendship.friendId);
                if (!friend) return null;

                // Get today's activity snapshot
                const today = new Date().toISOString().split("T")[0];
                const todayActivity = await ctx.db
                    .query("activitySnapshots")
                    .withIndex("by_user_and_date", (q) =>
                        q.eq("userId", friendship.friendId).eq("date", today)
                    )
                    .first();

                // Most recent activity snapshot for "last active" UI
                const latestActivity = await ctx.db
                    .query("activitySnapshots")
                    .withIndex("by_user", (q) => q.eq("userId", friendship.friendId))
                    .order("desc")
                    .first();

                return {
                    friendshipId: friendship._id,
                    id: friend._id,
                    name: friend.name,
                    image: friend.image,
                    level: friend.level || 1,
                    totalXP: friend.totalXP || 0,
                    currentStreak: friend.currentStreak || 0,
                    since: friendship.createdAt,
                    lastActiveAt: latestActivity ? `${latestActivity.date}T00:00:00.000Z` : null,
                    todayActivity: todayActivity ? {
                        tasksCompleted: todayActivity.tasksCompleted,
                        habitsCompleted: todayActivity.habitsCompleted,
                        xpEarned: todayActivity.xpEarned,
                        streakMaintained: todayActivity.streakMaintained,
                    } : null,
                };
            })
        );

        return friends.filter(Boolean);
    },
});

// Remove a friend
export const removeFriend = mutation({
    args: {
        friendId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        // Delete both directions
        const friendship1 = await ctx.db
            .query("friendships")
            .withIndex("by_user_and_friend", (q) =>
                q.eq("userId", userId).eq("friendId", args.friendId)
            )
            .first();

        const friendship2 = await ctx.db
            .query("friendships")
            .withIndex("by_user_and_friend", (q) =>
                q.eq("userId", args.friendId).eq("friendId", userId)
            )
            .first();

        if (friendship1) await ctx.db.delete(friendship1._id);
        if (friendship2) await ctx.db.delete(friendship2._id);

        return { success: true };
    },
});

// ==================== CHEERS & ENCOURAGEMENT ====================

const CHEER_TYPES = ["clap", "fire", "star", "heart", "rocket", "trophy"] as const;
const QUICK_MESSAGES = [
    "Keep going! 💪",
    "You're crushing it!",
    "Proud of you!",
    "Amazing progress!",
    "Stay strong!",
    "You've got this!",
] as const;

// Send a cheer to a friend
export const sendCheer = mutation({
    args: {
        toUserId: v.id("users"),
        type: v.string(),
        message: v.optional(v.string()),
        milestoneId: v.optional(v.id("milestones")),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        // Verify friendship
        const friendship = await ctx.db
            .query("friendships")
            .withIndex("by_user_and_friend", (q) =>
                q.eq("userId", userId).eq("friendId", args.toUserId)
            )
            .first();

        if (!friendship) {
            throw new Error("You can only cheer your friends");
        }

        const user = await ctx.db.get(userId);
        const now = new Date().toISOString();

        const cheerId = await ctx.db.insert("cheers", {
            fromUserId: userId,
            toUserId: args.toUserId,
            type: args.type,
            message: args.message,
            milestoneId: args.milestoneId,
            createdAt: now,
            seen: false,
        });

        // Create notification
        await ctx.db.insert("socialNotifications", {
            userId: args.toUserId,
            type: "cheer_received",
            fromUserId: userId,
            referenceId: cheerId,
            referenceType: "cheer",
            message: `${user?.name || 'A friend'} sent you a cheer! ${getCheerEmoji(args.type)}`,
            seen: false,
            createdAt: now,
        });

        return { cheerId };
    },
});

function getCheerEmoji(type: string): string {
    const emojis: Record<string, string> = {
        clap: "👏",
        fire: "🔥",
        star: "⭐",
        heart: "❤️",
        rocket: "🚀",
        trophy: "🏆",
    };
    return emojis[type] || "🎉";
}

// Get cheers received
export const getCheersReceived = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) return [];

        const cheers = await ctx.db
            .query("cheers")
            .withIndex("by_to_user", (q) => q.eq("toUserId", userId))
            .order("desc")
            .take(args.limit || 20);

        // Enrich with sender info
        const enrichedCheers = await Promise.all(
            cheers.map(async (cheer) => {
                const fromUser = await ctx.db.get(cheer.fromUserId);
                return {
                    ...cheer,
                    fromUser: fromUser ? {
                        name: fromUser.name,
                        image: fromUser.image,
                    } : null,
                };
            })
        );

        return enrichedCheers;
    },
});

// Mark cheers as seen
export const markCheersAsSeen = mutation({
    args: {},
    handler: async (ctx) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        const unseenCheers = await ctx.db
            .query("cheers")
            .withIndex("by_to_user", (q) => q.eq("toUserId", userId))
            .filter((q) => q.eq(q.field("seen"), false))
            .collect();

        await Promise.all(
            unseenCheers.map((cheer) => ctx.db.patch(cheer._id, { seen: true }))
        );

        return { count: unseenCheers.length };
    },
});

// ==================== NOTIFICATIONS ====================

export const getSocialNotifications = query({
    args: {
        limit: v.optional(v.number()),
        unreadOnly: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) return [];

        let query = ctx.db
            .query("socialNotifications")
            .withIndex("by_user", (q) => q.eq("userId", userId));

        if (args.unreadOnly) {
            query = query.filter((q) => q.eq(q.field("seen"), false));
        }

        const notifications = await query.order("desc").take(args.limit || 50);

        // Enrich with user info
        const enriched = await Promise.all(
            notifications.map(async (notif) => {
                const fromUser = notif.fromUserId ? await ctx.db.get(notif.fromUserId) : null;
                return {
                    ...notif,
                    fromUser: fromUser ? {
                        name: fromUser.name,
                        image: fromUser.image,
                    } : null,
                };
            })
        );

        return enriched;
    },
});

export const markNotificationsAsSeen = mutation({
    args: {
        notificationIds: v.optional(v.array(v.id("socialNotifications"))),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) throw new Error("Unauthenticated");

        if (args.notificationIds) {
            // Mark specific notifications
            await Promise.all(
                args.notificationIds.map((id) => ctx.db.patch(id, { seen: true }))
            );
        } else {
            // Mark all as seen
            const unseen = await ctx.db
                .query("socialNotifications")
                .withIndex("by_user_and_seen", (q) => q.eq("userId", userId).eq("seen", false))
                .collect();

            await Promise.all(
                unseen.map((notif) => ctx.db.patch(notif._id, { seen: true }))
            );
        }

        return { success: true };
    },
});

export const getUnreadNotificationCount = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getUserId(ctx);
        if (!userId) return 0;

        const unseen = await ctx.db
            .query("socialNotifications")
            .withIndex("by_user_and_seen", (q) => q.eq("userId", userId).eq("seen", false))
            .collect();

        return unseen.length;
    },
});
