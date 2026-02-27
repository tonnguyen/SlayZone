/**
 * Project column utility tests
 * Run with: npx tsx packages/domains/projects/src/shared/columns.test.ts
 */
import { describe, expect, test } from '../../../../shared/test-utils/ipc-harness.js'
import { DEFAULT_COLUMNS, type ColumnConfig } from './types.js'
import {
  getDefaultStatus,
  getDoneStatus,
  isCompletedStatus,
  isKnownStatus,
  isTerminalStatus,
  normalizeStatusOrDefault,
  parseColumnsConfig,
  resolveColumns,
  validateColumns,
} from './columns.js'

const customColumns: ColumnConfig[] = [
  { id: 'blocked', label: 'Blocked', color: 'red', position: 2, category: 'started' },
  { id: 'queue', label: 'Queue', color: 'gray', position: 0, category: 'unstarted' },
  { id: 'closed', label: 'Closed', color: 'green', position: 4, category: 'completed' },
  { id: 'wontfix', label: 'Wontfix', color: 'slate', position: 5, category: 'canceled' },
]

describe('validateColumns', () => {
  test('sorts columns and normalizes positions', () => {
    const normalized = validateColumns(customColumns)
    expect(normalized).toEqual([
      { id: 'queue', label: 'Queue', color: 'gray', position: 0, category: 'unstarted' },
      { id: 'blocked', label: 'Blocked', color: 'red', position: 1, category: 'started' },
      { id: 'closed', label: 'Closed', color: 'green', position: 2, category: 'completed' },
      { id: 'wontfix', label: 'Wontfix', color: 'slate', position: 3, category: 'canceled' },
    ])
  })

  test('requires at least one completed column', () => {
    const invalid: ColumnConfig[] = [
      { id: 'queue', label: 'Queue', color: 'gray', position: 0, category: 'unstarted' },
      { id: 'doing', label: 'Doing', color: 'blue', position: 1, category: 'started' },
      { id: 'canceled', label: 'Canceled', color: 'slate', position: 2, category: 'canceled' },
    ]
    expect(() => validateColumns(invalid)).toThrow()
  })
})

describe('parseColumnsConfig/resolveColumns', () => {
  test('parses and validates JSON payloads', () => {
    const parsed = parseColumnsConfig(JSON.stringify(customColumns))
    expect(parsed?.map((column) => column.id)).toEqual(['queue', 'blocked', 'closed', 'wontfix'])
  })

  test('returns null for invalid JSON or invalid shape', () => {
    expect(parseColumnsConfig('{bad json')).toBeNull()
    expect(parseColumnsConfig('{"foo":"bar"}')).toBeNull()
  })

  test('falls back to defaults on invalid config', () => {
    const resolved = resolveColumns(parseColumnsConfig('{"foo":"bar"}'))
    expect(resolved).toEqual(DEFAULT_COLUMNS)
  })

  test('returns cloned defaults so callers cannot mutate shared constants', () => {
    const resolved = resolveColumns(null)
    expect(resolved).toEqual(DEFAULT_COLUMNS)
    expect(resolved === DEFAULT_COLUMNS).toBe(false)
    resolved[0].label = 'Mutated'
    expect(DEFAULT_COLUMNS[0].label).toBe('Inbox')
  })
})

describe('status helpers', () => {
  test('computes project default and done statuses', () => {
    expect(getDefaultStatus(customColumns)).toBe('queue')
    expect(getDoneStatus(customColumns)).toBe('closed')
  })

  test('handles terminal/completed semantics by category', () => {
    expect(isTerminalStatus('closed', customColumns)).toBe(true)
    expect(isTerminalStatus('wontfix', customColumns)).toBe(true)
    expect(isTerminalStatus('blocked', customColumns)).toBe(false)

    expect(isCompletedStatus('closed', customColumns)).toBe(true)
    expect(isCompletedStatus('wontfix', customColumns)).toBe(false)
  })

  test('normalizes unknown statuses to the project default', () => {
    expect(isKnownStatus('blocked', customColumns)).toBe(true)
    expect(isKnownStatus('not_real', customColumns)).toBe(false)
    expect(normalizeStatusOrDefault('not_real', customColumns)).toBe('queue')
    expect(normalizeStatusOrDefault('blocked', customColumns)).toBe('blocked')
  })
})

console.log('\nDone')
