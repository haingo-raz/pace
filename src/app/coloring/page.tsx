import { connection } from 'next/server'
import { AppShell } from '@/components/ui/AppShell'
import { ColoringShell } from './ColoringShell'
import { requireUser } from '@/lib/auth'
import {
  getMostRecentPageId,
  getOrCreateDrawing,
  listPages,
} from '@/lib/queries/coloring'
import { getProfile } from '@/lib/queries/profile'

export const instant = false

export default async function ColoringPage() {
  await connection()
  const userId = await requireUser()
  const pages = await listPages()
  if (pages.length === 0) {
    throw new Error('No coloring page is seeded.')
  }

  const recentId = await getMostRecentPageId(userId)
  const initialPage = pages.find((p) => p.id === recentId) ?? pages[0]

  const [drawing, profile] = await Promise.all([
    getOrCreateDrawing(userId, initialPage.id),
    getProfile(userId),
  ])

  return (
    <AppShell>
      <ColoringShell
        pages={pages}
        initialPage={initialPage}
        initialState={drawing.sections_state}
        initialPointsTotal={profile?.points_total ?? 0}
        initialComplete={!!drawing.completed_at}
      />
    </AppShell>
  )
}
