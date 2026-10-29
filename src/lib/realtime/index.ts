// Public surface of the realtime layer (spec 03). Screens use the hooks and never touch a socket.

export { useRealtimeEvent, useRealtimeEventLog, useRealtimeStatus } from './hooks'
export { realtime } from './instance'
export type {
  EventLogEntry,
  EventOutcome,
  RealtimeManager,
  RealtimeSession,
  RealtimeStatus,
} from './manager'
