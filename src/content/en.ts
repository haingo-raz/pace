export const copy = {
  app: { name: 'Pace', tagline: 'A job search that paces itself.' },
  landing: {
    description:
      'Pace is a wellbeing companion for your job search: log how today feels, keep a short task list that reorders itself to match, and spend the points you earn colouring a page of your own.',
  },
  auth: {
    signInTitle: 'Welcome back',
    signUpTitle: 'Start at your own pace',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    signIn: 'Sign in',
    signUp: 'Create account',
    toggleToSignUp: 'New here? Create an account',
    toggleToSignIn: 'Already have an account? Sign in',
  },
  checkin: {
    question: 'How are you today?',
    moods: { 1: 'Rough', 2: 'Okay', 3: 'Good', 4: 'Great' },
    skip: 'Skip for now',
    done: 'Logged for today',
  },
  tasks: {
    heading: 'Today',
    empty: 'Nothing here yet. Add the first thing you want to get done.',
    add: 'Add task',
    titleLabel: 'Task',
    difficultyLabel: 'How hard does it feel?',
    deadlineLabel: 'Deadline (optional)',
    laterDivider: 'When you have more in the tank',
    complete: 'Mark done',
    delete: 'Delete',
  },
  coloring: {
    heading: 'Your page',
    costNote: 'Each section costs {cost} points',
    cantAfford: 'You need {cost} points to fill a section.',
    filled: 'filled with {colour}',
    empty: 'not filled yet',
    progress: '{done} of {total} sections filled',
  },
  nav: {
    label: 'Primary',
    home: 'Home',
    coloring: 'Colour',
  },
  errors: {
    generic: 'Something went wrong. Try again.',
    NETWORK: 'Could not reach Pace. Check your connection.',
    VALIDATION_ERROR: 'Please check the highlighted fields.',
    UNAUTHENTICATED: 'Please sign in again.',
    NOT_FOUND: 'That is no longer there.',
    CONFLICT: 'That has already been done.',
    INSUFFICIENT_POINTS: 'Not enough points yet.',
    INTERNAL: 'Something went wrong on our end. Try again.',
  },
} as const

export function fill(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
