import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { ColoringShell } from './ColoringShell'
import { requireUser } from '@/lib/auth'
import {
  getActivePage,
  getOrCreateDrawing,
} from '@/lib/queries/coloring'
import { getProfile } from '@/lib/queries/profile'

export const instant = false

export default async function ColoringPage() {
  await connection()
  const userId = await requireUser()
  const page = await getActivePage()
  if (!page) {
    throw new Error('No coloring page is seeded.')
  }
  const [drawing, profile] = await Promise.all([
    getOrCreateDrawing(userId, page.id),
    getProfile(userId),
  ])

  return (
    <AppShell>
      <ColoringShell
        initialPage={page}
        initialState={drawing.sections_state}
        initialPointsTotal={profile?.points_total ?? 0}
        initialComplete={!!drawing.completed_at}
      />
    </AppShell>
  )
}
