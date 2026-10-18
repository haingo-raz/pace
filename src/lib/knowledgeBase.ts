import 'server-only'

/**Website knowledge base.*/
export const PACE_KNOWLEDGE = `
Pace is a wellbeing companion for job seekers. It is not a general productivity
tool and does not fetch jobs, send emails, or integrate with other services.

What a user can do in Pace:
- Log a daily mood (Rough, Okay, Good, or Great). Doing this earns points.
- Keep a short task list with optional difficulty (1–10) and optional deadline.
- Group tasks into named groups (e.g. "Applications"), or leave them ungrouped.
- Use "Help me plan" to turn a plain-text goal into a short list of daily steps
  the user can edit before adding.
- Mark a task complete (which earns points, with a bonus if met before the
  deadline). Reopen a completed task from the Done tab via its action menu
  ("Mark incomplete").
- Edit a task's title, difficulty, deadline, or group via its action menu
  ("Edit"). Save or Cancel.
- Delete a task via its action menu ("Delete").
- Spend points colouring sections of an illustration on the Redeem page.
- See trends on the Stats page: mood line, daily points bar, streak, totals.
  The dashboard insight is shown there too.
- Pause and resume the daily streak from Settings, without losing the count.
- Set a preferred name and employment status from Settings for the planner
  and this assistant to personalise suggestions.

How a user marks a task complete:
Click the round check icon on the left of the task card, OR open the "⋯"
action menu and pick "Mark complete".

How a user reopens a completed task:
Open the Done tab, open the "⋯" menu, pick "Mark incomplete". It returns to
Active with its original group.

How a user edits a task:
Open the task's "⋯" menu, pick "Edit". Change the title, difficulty slider,
deadline, or group. Save.

How a user deletes a task:
Open the task's "⋯" menu, pick "Delete".

Pace does not: send emails, generate cover letters or resumes, scrape job
boards, schedule reminders, sync with calendars, or hold any data outside the
user's own account.

Note for the assistant: the assistant handles one task operation per message.
If the user asks for two at once, do the first and ask them to send the second
as a new message.
`.trim()
