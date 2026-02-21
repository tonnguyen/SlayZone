import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')
  return identity
}

function authUserIdFromSubject(subject: string | undefined): Id<'users'> | null {
  if (!subject) return null
  const [userId] = subject.split('|')
  if (!userId) return null
  return userId as Id<'users'>
}

async function findCurrentUser(ctx: QueryCtx | MutationCtx, tokenIdentifier: string, subject?: string): Promise<Doc<'users'> | null> {
  const authUserId = authUserIdFromSubject(subject)
  const authUser = authUserId ? await ctx.db.get(authUserId) : null
  if (authUser) return authUser

  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .first()
}

async function upsertViewer(ctx: MutationCtx): Promise<Id<'users'>> {
  const identity = await requireIdentity(ctx)
  const profile = identity as Record<string, unknown>
  const now = Date.now()
  const tokenIdentifier = identity.tokenIdentifier
  const githubId = typeof identity.subject === 'string' ? identity.subject : undefined
  const githubLogin =
    typeof profile.nickname === 'string'
      ? profile.nickname
      : typeof profile.preferred_username === 'string'
        ? profile.preferred_username
        : typeof profile.login === 'string'
          ? profile.login
          : undefined
  const name = typeof profile.name === 'string' ? profile.name : undefined
  const image =
    typeof profile.pictureUrl === 'string'
      ? profile.pictureUrl
      : typeof profile.picture === 'string'
        ? profile.picture
        : typeof profile.image === 'string'
          ? profile.image
          : typeof profile.avatar_url === 'string'
            ? profile.avatar_url
        : undefined

  const legacyUser = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .first()

  const authUserId = authUserIdFromSubject(identity.subject)
  const authUser = authUserId ? await ctx.db.get(authUserId) : null

  if (authUser) {
    await ctx.db.patch(authUser._id, {
      tokenIdentifier,
      githubId: githubId ?? authUser.githubId,
      githubLogin: githubLogin ?? authUser.githubLogin,
      name: name ?? authUser.name,
      image: image ?? authUser.image,
      updatedAt: now
    })

    // Migrate legacy totals from older tokenIdentifier-linked user rows.
    if (legacyUser && legacyUser._id !== authUser._id) {
      const legacyTotals = await ctx.db
        .query('leaderboardTotals')
        .withIndex('by_userId', (q) => q.eq('userId', legacyUser._id))
        .collect()
      for (const total of legacyTotals) {
        await ctx.db.patch(total._id, { userId: authUser._id, updatedAt: now })
      }
      await ctx.db.delete(legacyUser._id)
    }

    return authUser._id
  }

  if (legacyUser) {
    await ctx.db.patch(legacyUser._id, {
      githubId: githubId ?? legacyUser.githubId,
      githubLogin: githubLogin ?? legacyUser.githubLogin,
      name: name ?? legacyUser.name,
      image: image ?? legacyUser.image,
      updatedAt: now
    })
    return legacyUser._id
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

function parseGithubNumericId(value: string | null | undefined): string | null {
  if (!value) return null
  return /^\d+$/.test(value) ? value : null
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
    const user = await findCurrentUser(ctx, identity.tokenIdentifier, identity.subject)

    if (!user) {
      return null
    }

    const githubAccount = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', user._id).eq('provider', 'github'))
      .first()

    const githubNumericId =
      parseGithubNumericId(githubAccount?.providerAccountId) ?? parseGithubNumericId(user.githubId ?? null)

    const totals = await ctx.db
      .query('leaderboardTotals')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    return {
      user: {
        id: user._id,
        githubId: user.githubId ?? null,
        githubNumericId,
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

export const forgetMe = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const user = await findCurrentUser(ctx, identity.tokenIdentifier, identity.subject)

    if (!user) {
      return { deleted: false, reason: 'user-not-found' as const }
    }

    const totals = await ctx.db
      .query('leaderboardTotals')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .collect()

    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', user._id))
      .collect()

    for (const total of totals) {
      await ctx.db.delete(total._id)
    }

    let deletedVerificationCodes = 0
    for (const account of accounts) {
      const verificationCodes = await ctx.db
        .query('authVerificationCodes')
        .withIndex('accountId', (q) => q.eq('accountId', account._id))
        .collect()
      for (const code of verificationCodes) {
        await ctx.db.delete(code._id)
        deletedVerificationCodes += 1
      }
      await ctx.db.delete(account._id)
    }

    let deletedRefreshTokens = 0
    for (const session of sessions) {
      const refreshTokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const token of refreshTokens) {
        await ctx.db.delete(token._id)
        deletedRefreshTokens += 1
      }
      await ctx.db.delete(session._id)
    }

    await ctx.db.delete(user._id)

    return {
      deleted: true,
      deletedLeaderboardTotals: totals.length,
      deletedAccounts: accounts.length,
      deletedSessions: sessions.length,
      deletedVerificationCodes,
      deletedRefreshTokens
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
