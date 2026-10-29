// Fictitious credentials, in plaintext only here and in the README. Deliberately no imports: the
// E2E tests read this file directly. `.example` is a reserved TLD, so no address reaches anyone.

export const CREDENTIALS = {
  ana: { id: 'usr_ana', email: 'ana@kurio.example', password: 'Kurio#Ana2026' },
  bruno: { id: 'usr_bruno', email: 'bruno@kurio.example', password: 'Kurio#Bruno2026' },
  carla: { id: 'usr_carla', email: 'carla@kurio.example', password: 'Kurio#Carla2026' },
} as const

export type CredentialName = keyof typeof CREDENTIALS
