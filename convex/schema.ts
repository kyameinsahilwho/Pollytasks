import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        image: v.optional(v.string()),
        tokenIdentifier: v.string(), // Clerk Idenfitier
        emailVerificationTime: v.optional(v.number()),
        phone: v.optional(v.string()),

        // User Settings
        totalXP: v.optional(v.number()),
        level: v.optional(v.number()),
        currentStreak: v.optional(v.number()),
        longestStreak: v.optional(v.number()),
        tasksCompleted: v.optional(v.number()),

        // Social settings
        shareActivity: v.optional(v.boolean()), // Allow friends to see activity
        shareStreak: v.optional(v.boolean()), // Share streak with friends
    })
        .index("email", ["email"])
        .index("by_token", ["tokenIdentifier"]),

    tasks: defineTable({
        userId: v.id("users"),
        title: v.string(),
        dueDate: v.optional(v.string()),
        isCompleted: v.boolean(),
        completedAt: v.optional(v.string()),
        createdAt: v.string(),
        projectId: v.optional(v.id("projects")),
        reminderAt: v.optional(v.string()),
        reminderEnabled: v.optional(v.boolean()),
        rewardXp: v.number(),

        supabaseId: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    subtasks: defineTable({
        taskId: v.id("tasks"),
        title: v.string(),
        isCompleted: v.boolean(),

        supabaseId: v.optional(v.string()),
    }).index("by_task", ["taskId"]),

    projects: defineTable({
        userId: v.id("users"),
        name: v.string(),
        description: v.optional(v.string()),
        color: v.string(),
        icon: v.string(),
        createdAt: v.string(),

        supabaseId: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    habits: defineTable({
        userId: v.id("users"),
        title: v.string(),
        description: v.optional(v.string()),
        frequency: v.string(), // 'daily', 'weekly', etc.
        currentStreak: v.number(),
        bestStreak: v.number(),
        color: v.string(),
        icon: v.string(),
        createdAt: v.string(),
        customDays: v.optional(v.array(v.number())),
        totalCompletions: v.number(),
        yearlyAchieved: v.optional(v.number()),
        yearlyExpected: v.optional(v.number()),
        statsYear: v.optional(v.number()),
        archived: v.optional(v.boolean()),
        reminderTime: v.optional(v.string()),
        reminderEnabled: v.optional(v.boolean()),

        supabaseId: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    habitCompletions: defineTable({
        habitId: v.id("habits"),
        userId: v.id("users"),
        completedAt: v.string(),

        supabaseId: v.optional(v.string()),
    }).index("by_habit", ["habitId"])
        .index("by_user", ["userId"]),

    reminders: defineTable({
        userId: v.id("users"),
        title: v.string(),
        description: v.optional(v.string()),
        type: v.string(), // 'one-time', 'ongoing'
        intervalUnit: v.optional(v.string()),
        intervalValue: v.optional(v.number()),
        remindAt: v.string(),
        isActive: v.boolean(),
        icon: v.string(),

        supabaseId: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // ==================== SOCIAL FEATURES ====================

    // Friend connections (bidirectional relationship)
    friendships: defineTable({
        userId: v.id("users"), // The user who has this friend
        friendId: v.id("users"), // The friend
        createdAt: v.string(),
        // We create two records for each friendship (A->B and B->A)
    })
        .index("by_user", ["userId"])
        .index("by_friend", ["friendId"])
        .index("by_user_and_friend", ["userId", "friendId"]),

    // Friend invitations sent via email
    friendInvites: defineTable({
        fromUserId: v.id("users"),
        toEmail: v.string(), // Invited email (may not be a user yet)
        toUserId: v.optional(v.id("users")), // Filled when invited user exists
        status: v.string(), // 'pending', 'accepted', 'declined', 'expired'
        inviteCode: v.string(), // Unique code for invitation link
        createdAt: v.string(),
        expiresAt: v.string(),
        respondedAt: v.optional(v.string()),
    })
        .index("by_from_user", ["fromUserId"])
        .index("by_to_email", ["toEmail"])
        .index("by_to_user", ["toUserId"])
        .index("by_invite_code", ["inviteCode"]),

    // Activity milestones - shared achievements (privacy-focused: counts only, no titles)
    milestones: defineTable({
        userId: v.id("users"),
        type: v.string(), // 'tasks_completed', 'streak_achieved', 'level_up', 'habit_streak', 'weekly_goal', 'challenge_completed'
        value: v.number(), // The milestone value (e.g., 100 tasks, 7-day streak)
        achievedAt: v.string(),
        isPublic: v.boolean(), // Whether friends can see this
        celebratedBy: v.optional(v.array(v.id("users"))), // Users who cheered this milestone
    })
        .index("by_user", ["userId"])
        .index("by_type", ["type"])
        .index("by_user_and_type", ["userId", "type"]),

    // Cheers/Reactions - send encouragement to friends
    cheers: defineTable({
        fromUserId: v.id("users"),
        toUserId: v.id("users"),
        milestoneId: v.optional(v.id("milestones")), // If cheering a specific milestone
        challengeId: v.optional(v.id("challenges")), // If cheering in a challenge
        type: v.string(), // 'clap', 'fire', 'star', 'heart', 'rocket', 'trophy'
        message: v.optional(v.string()), // Optional quick message (predefined options only)
        createdAt: v.string(),
        seen: v.boolean(),
    })
        .index("by_from_user", ["fromUserId"])
        .index("by_to_user", ["toUserId"])
        .index("by_milestone", ["milestoneId"]),

    // Accountability challenges between friends
    challenges: defineTable({
        creatorId: v.id("users"),
        title: v.string(), // e.g., "7-Day Streak Challenge", "Complete 50 Tasks"
        description: v.optional(v.string()),
        type: v.string(), // 'streak', 'tasks_count', 'habits_count', 'custom'
        targetValue: v.number(), // Goal to achieve
        startDate: v.string(),
        endDate: v.string(),
        status: v.string(), // 'pending', 'active', 'completed', 'cancelled'
        visibility: v.string(), // 'private' (invite only), 'friends' (visible to all friends)
        createdAt: v.string(),
    })
        .index("by_creator", ["creatorId"])
        .index("by_status", ["status"]),

    // Challenge participants and progress
    challengeParticipants: defineTable({
        challengeId: v.id("challenges"),
        userId: v.id("users"),
        status: v.string(), // 'invited', 'accepted', 'declined', 'completed', 'failed'
        progress: v.number(), // Current progress towards goal
        joinedAt: v.optional(v.string()),
        completedAt: v.optional(v.string()),
        rank: v.optional(v.number()), // Final rank if challenge completed
    })
        .index("by_challenge", ["challengeId"])
        .index("by_user", ["userId"])
        .index("by_challenge_and_user", ["challengeId", "userId"]),

    // Daily activity snapshots for friends feed (privacy: only counts, no details)
    activitySnapshots: defineTable({
        userId: v.id("users"),
        date: v.string(), // YYYY-MM-DD format
        tasksCompleted: v.number(),
        habitsCompleted: v.number(),
        xpEarned: v.number(),
        streakMaintained: v.boolean(),
    })
        .index("by_user", ["userId"])
        .index("by_date", ["date"])
        .index("by_user_and_date", ["userId", "date"]),

    // Notifications for social events
    socialNotifications: defineTable({
        userId: v.id("users"), // Who receives the notification
        type: v.string(), // 'friend_request', 'friend_accepted', 'cheer_received', 'challenge_invite', 'challenge_update', 'milestone_friend'
        fromUserId: v.optional(v.id("users")),
        referenceId: v.optional(v.string()), // ID of related entity (milestone, challenge, etc.)
        referenceType: v.optional(v.string()), // Type of reference entity
        message: v.string(),
        seen: v.boolean(),
        createdAt: v.string(),
    })
        .index("by_user", ["userId"])
        .index("by_user_and_seen", ["userId", "seen"]),

    // Weblogs for markdown notes and audio notes
    weblogs: defineTable({
        userId: v.id("users"),
        title: v.string(), // Extracted or default title
        content: v.string(), // Main content (structured text if audio, or raw markdown)
        rawTranscript: v.optional(v.string()), // For audio notes: raw transcription
        audioStorageId: v.optional(v.id("_storage")), // Convex storage ID for the audio file
        emoji: v.optional(v.string()),
        color: v.optional(v.string()), // yellow, pink, blue, green
        isPinned: v.optional(v.boolean()),
        category: v.optional(v.string()), // "journal", "ideas", "learning", "personal"
        folderId: v.optional(v.string()), // Custom folder
        tags: v.optional(v.array(v.string())), // Custom tags for organization
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index("by_user", ["userId"])
        .index("by_user_and_category", ["userId", "category"])
        .index("by_user_and_pinned", ["userId", "isPinned"])
        .index("by_folder", ["folderId"]),

    weblogFolders: defineTable({
        userId: v.id("users"),
        name: v.string(),
        icon: v.string(),
        color: v.string(),
        createdAt: v.string(),
    }).index("by_user", ["userId"]),
});
