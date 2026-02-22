import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

const { users: _authUsers, ...restAuthTables } = authTables

export default defineSchema({
  ...restAuthTables,

  users: defineTable({
    // Required Convex Auth user fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // App-specific identity/profile fields
    tokenIdentifier: v.optional(v.string()),
    githubId: v.optional(v.string()),
    githubLogin: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number())
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_githubId', ['githubId']),

  leaderboardDailyStats: defineTable({
    userId: v.id('users'),
    date: v.string(), // YYYY-MM-DD
    totalTokens: v.number(),
    totalCompletedTasks: v.number(),
    updatedAt: v.number()
  })
    .index('by_userId', ['userId'])
    .index('by_date', ['date'])
    .index('by_userId_and_date', ['userId', 'date'])
})
