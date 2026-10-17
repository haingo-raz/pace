import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'

const url = process.env.TIGER_DATABASE_URL
if (!url) {
  console.error('TIGER_DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 10 })

type Row = {
  user_id: string
  points_total: number
  ledger: number
}

async function main() {
  const rows = await sql<Row[]>`
    select p.user_id,
           p.points_total,
           (select coalesce(sum(amount), 0)
            from points_log
            where user_id = p.user_id) as ledger
    from profiles p
  `

  if (rows.length === 0) {
    console.log('no profiles yet')
    return
  }

  let failed = 0
  for (const r of rows) {
    const ok = Number(r.points_total) === Number(r.ledger)
    const tag = ok ? 'PASS' : 'FAIL'
    if (!ok) failed++
    console.log(
      `${tag}  user=${r.user_id}  cache=${r.points_total}  ledger=${r.ledger}`,
    )
  }
  if (failed > 0) {
    console.error(`\n${failed} row(s) FAILED`)
    process.exitCode = 1
  } else {
    console.log(`\nall ${rows.length} row(s) PASS`)
  }
}

main()
  .catch((e) => {
    console.error('ERROR:', e.message)
    process.exitCode = 1
  })
  .finally(() => sql.end())
