import type { MoodScore } from '@/types'

/**
 * Short motivational notes shown on the mood card. Picked at random from the
 * list matching the user's selected mood.
 */
export const MOOD_QUOTES: Record<MoodScore, readonly string[]> = {
  1: [
    'Being here on a rough day is already a lot.',
    'Rest is doing something. Really.',
    'Soft day, soft goals. Both count.',
    'You do not have to earn tomorrow.',
    'One small thing is plenty right now.',
    'Hard days ask for kindness, not performance.',
    'You showed up. That is the step.',
    'Breathing counts. Water counts. Sleep counts.',
    'Nothing you feel today is proof of anything about you.',
    'Slow is a pace too.',
  ],
  2: [
    'Okay is a steady place to start.',
    'Not every day needs to be big.',
    'Little moves still move you.',
    'Pick one gentle thing and let that be enough.',
    'Even background progress is progress.',
    'Showing up on an okay day is quietly brave.',
    'You can lean into one thing today.',
    'Average days build the week.',
    'The next small step is the only one that matters.',
    'Steady beats sudden.',
  ],
  3: [
    'Good day — ride the easy wind for a bit.',
    'Keep the pace that feels kind.',
    'You know the shape of today. Use it.',
    'A good day plus one small win is a great day waiting.',
    'Lean into what feels possible.',
    'Momentum likes a hand to hold. Give it one.',
    'Nice. Keep going at your own tempo.',
    'This is the energy to spend thoughtfully.',
    'A good day is a soft runway.',
    'Lovely. Pick a step and start.',
  ],
  4: [
    'Great day — enjoy it without owing it anything.',
    'Celebrate first. Plan second.',
    'This is yours. Soak it in.',
    'Great days can be about joy, not output.',
    'You can go far today, or sit still. Both are wins.',
    'Pour it into one thing you care about.',
    'Light yourself up a little.',
    'Great energy is best spent on things you love.',
    'Days like this are worth remembering. Note it somewhere.',
    'Fantastic. Keep it kind and keep it yours.',
  ],
}

export function pickMoodQuote(mood: MoodScore): string {
  const list = MOOD_QUOTES[mood]
  const i = Math.floor(Math.random() * list.length)
  return list[i] ?? list[0]
}
