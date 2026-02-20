export type TelemetryTier = 'anonymous' | 'opted_in'

export type TelemetryEventName =
  | 'app_opened'
  | 'heartbeat'
  | 'app_backgrounded'

export interface TelemetryEventProps {
  app_opened: { version: string }
  heartbeat: {
    active_ms: number
    active_minutes: number
  }
  app_backgrounded: {
    reason: 'backgrounded' | 'shutdown'
    active_ms: number
    active_minutes: number
  }
}
