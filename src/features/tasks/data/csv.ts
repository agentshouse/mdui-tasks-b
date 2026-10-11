import { taskFieldsSchema, type Task, type TaskFields } from './schema'
const headers = ['title', 'status', 'label', 'priority'] as const

export function parseTasksCsv(text: string): TaskFields[] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let closedQuote = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (closedQuote && ch !== ',' && ch !== '\n' && ch !== '\r') throw new Error('Unexpected text after a quoted CSV field.')
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++ }
      else if (!quoted && field.length > 0) throw new Error('Unexpected quote in CSV field.')
      else { closedQuote = quoted; quoted = !quoted }
    } else if (ch === ',' && !quoted) { row.push(field); field = ''; closedQuote = false }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(field); if (row.some((value) => value.trim())) rows.push(row); row = []; field = ''; closedQuote = false
    } else field += ch
  }
  if (quoted) throw new Error('CSV has an unclosed quote.')
  row.push(field); if (row.some((value) => value.trim())) rows.push(row)
  const names = rows.shift()?.map((value) => value.trim().toLowerCase())
  if (!names || headers.some((name) => !names.includes(name))) throw new Error('CSV needs title, status, label, and priority headers.')
  if (!rows.length) throw new Error('CSV has no task rows.')
  if (rows.length > 250) throw new Error('Import at most 250 tasks at a time.')
  return rows.map((values, index) => {
    if (values.length !== names.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`)
    const result = taskFieldsSchema.safeParse(Object.fromEntries(headers.map((name) => [name, values[names.indexOf(name)]])))
    if (!result.success) throw new Error(`CSV row ${index + 2}: ${result.error.issues[0].message}`)
    return result.data
  })
}
export function tasksCsv(tasks: Task[]) {
  const escape = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'
  const fields = ['id', ...headers] as const
  return [fields.join(','), ...tasks.map((task) => fields.map((key) => escape(task[key])).join(','))].join('\r\n')
}
export function downloadTasks(tasks: Task[]) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + tasksCsv(tasks)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tasks.csv'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
