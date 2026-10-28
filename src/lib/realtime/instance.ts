import { createRealtimeManager } from './manager'

/** The tab's one manager (RT-19). `app.tsx` starts it; spec 04 sets the session. */
export const realtime = createRealtimeManager()
