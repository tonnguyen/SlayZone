import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    githubId: v.optional(v.string()),
    githubLogin: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_githubId', ['githubId']),

  leaderboardTotals: defineTable({
    userId: v.id('users'),
    totalTokens: v.number(),
    totalCompletedTasks: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_userId', ['userId'])
})
