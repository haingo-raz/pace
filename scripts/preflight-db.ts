import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'

const url = process.env.TIGER_DATABASE_URL
if (!url) {
  console.error('TIGER_DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 10 })

async function main() {
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by 1
  `
  console.log('tables:', tables.map((t) => t.table_name))

  const hypertables = await sql<{ hypertable_name: string }[]>`
    select hypertable_name from timescaledb_information.hypertables order by 1
  `
  console.log('hypertables:', hypertables.map((h) => h.hypertable_name))

  const aggregates = await sql<{ view_name: string }[]>`
    select view_name from timescaledb_information.continuous_aggregates order by 1
  `
  console.log('continuous_aggregates:', aggregates.map((a) => a.view_name))

  const pages = await sql<
    { slug: string; total_sections: number; paths: number }[]
  >`
    select slug, total_sections, jsonb_array_length(sections) as paths
    from coloring_pages
  `
  console.log('coloring_pages:', pages)

  const uniq = await sql<{ conname: string }[]>`
    select conname from pg_constraint
    where conrelid = 'checkins'::regclass and contype = 'u'
  `
  console.log('checkins unique constraints:', uniq.map((u) => u.conname))
}

main()
  .catch((e) => {
    console.error('ERROR:', e.message)
    process.exitCode = 1
  })
  .finally(() => sql.end())
