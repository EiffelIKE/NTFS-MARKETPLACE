import { toast, type ExternalToast } from 'sonner'

export { announce } from './announcer-store'

type NotifyOptions = Pick<ExternalToast, 'action' | 'description' | 'duration' | 'id'>

/**
 * Visible feedback for mutations and realtime changes (DS-19). Sonner's region is `aria-live`, so a
 * toast is announced by itself: use either `notify.*` or `announce()` for one event, never both.
 */
export const notify = {
  success: (message: string, options?: NotifyOptions) => toast.success(message, options),
  error: (message: string, options?: NotifyOptions) => toast.error(message, options),
  info: (message: string, options?: NotifyOptions) => toast.info(message, options),
}
