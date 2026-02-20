import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')
  return identity
}

async function upsertViewer(ctx: MutationCtx): Promise<Id<'users'>> {
  const identity = await requireIdentity(ctx)
  const profile = identity as Record<string, unknown>
  const now = Date.now()
  const tokenIdentifier = identity.tokenIdentifier
  const githubId = typeof identity.subject === 'string' ? identity.subject : undefined
  const githubLogin = typeof profile.nickname === 'string' ? profile.nickname : undefined
  const name = typeof profile.name === 'string' ? profile.name : undefined
  const image =
    typeof profile.pictureUrl === 'string'
      ? profile.pictureUrl
      : typeof profile.picture === 'string'
        ? profile.picture
        : undefined

  const existing = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      githubId: githubId ?? existing.githubId,
      githubLogin: githubLogin ?? existing.githubLogin,
      name: name ?? existing.name,
      image: image ?? existing.image,
      updatedAt: now
    })
    return existing._id
  }

  return await ctx.db.insert('users', {
    tokenIdentifier,
    githubId,
    githubLogin,
    name,
    image,
    createdAt: now,
    updatedAt: now
  })
}

function displayNameForUser(user: Doc<'users'>): string {
  return user.githubLogin ?? user.name ?? 'Unknown'
}

export const syncViewerProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await upsertViewer(ctx)
    return { userId }
  }
})

export const reportTotals = mutation({
  args: {
    totalTokens: v.number(),
    totalCompletedTasks: v.number()
  },
  handler: async (ctx, args) => {
    if (args.totalTokens < 0 || args.totalCompletedTasks < 0) {
      throw new Error('Totals must be non-negative')
    }

    const userId = await upsertViewer(ctx)
    const now = Date.now()

    const existing = await ctx.db
      .query('leaderboardTotals')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalTokens: args.totalTokens,
        totalCompletedTasks: args.totalCompletedTasks,
        updatedAt: now
      })
      return { id: existing._id }
    }

    const id = await ctx.db.insert('leaderboardTotals', {
      userId,
      totalTokens: args.totalTokens,
      totalCompletedTasks: args.totalCompletedTasks,
      createdAt: now,
      updatedAt: now
    })
    return { id }
  }
})

export const getMyTotals = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .first()

    if (!user) {
      return null
    }

    const totals = await ctx.db
      .query('leaderboardTotals')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    return {
      user: {
        id: user._id,
        githubLogin: user.githubLogin ?? null,
        name: user.name ?? null,
        image: user.image ?? null
      },
      totals: totals
        ? {
            totalTokens: totals.totalTokens,
            totalCompletedTasks: totals.totalCompletedTasks,
            updatedAt: totals.updatedAt
          }
        : null
    }
  }
})

export const topByTotalTokens = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 100)
    const totals = await ctx.db.query('leaderboardTotals').collect()
    const usersById = new Map<Id<'users'>, Doc<'users'>>()

    for (const total of totals) {
      const user = await ctx.db.get(total.userId)
      if (user) usersById.set(user._id, user)
    }

    return totals
      .map((total) => {
        const user = usersById.get(total.userId)
        return {
          userId: total.userId,
          displayName: user ? displayNameForUser(user) : 'Unknown',
          githubLogin: user?.githubLogin ?? null,
          image: user?.image ?? null,
          totalTokens: total.totalTokens,
          updatedAt: total.updatedAt
        }
      })
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, limit)
  }
})

export const topByCompletedTasks = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 100)
    const totals = await ctx.db.query('leaderboardTotals').collect()
    const usersById = new Map<Id<'users'>, Doc<'users'>>()

    for (const total of totals) {
      const user = await ctx.db.get(total.userId)
      if (user) usersById.set(user._id, user)
    }

    return totals
      .map((total) => {
        const user = usersById.get(total.userId)
        return {
          userId: total.userId,
          displayName: user ? displayNameForUser(user) : 'Unknown',
          githubLogin: user?.githubLogin ?? null,
          image: user?.image ?? null,
          totalCompletedTasks: total.totalCompletedTasks,
          updatedAt: total.updatedAt
        }
      })
      .sort((a, b) => b.totalCompletedTasks - a.totalCompletedTasks)
      .slice(0, limit)
  }
})
