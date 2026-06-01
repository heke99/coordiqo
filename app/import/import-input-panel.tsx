'use client'

import { useMemo, useState } from 'react'

import { Field, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { runPasteImportAction } from '@/lib/import/actions'

const targets = [
  { value: 'staff', label: 'Personal' },
  { value: 'resources', label: 'Resurser' },
  { value: 'entities', label: 'Kunder/objekt' },
  { value: 'tasks', label: 'Uppdrag' },
  { value: 'projects', label: 'Projekt' },
]

const sample = `full_name,email,phone,team,job_title
Anna Andersson,anna@example.com,+46700000001,Malmö,Chaufför
Ali Hassan,ali@example.com,+46700000002,Lund,Teamledare`

function splitLine(line: string) {
  const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ','
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''))
}

function parsePreview(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] as string[][] }
  return {
    headers: splitLine(lines[0]),
    rows: lines.slice(1, 8).map(splitLine),
  }
}

export function ImportInputPanel() {
  const [text, setText] = useState(sample)
  const preview = useMemo(() => parsePreview(text), [text])

  return (
    <section className="coordiqo-card p-5">
      <h2 className="text-lg font-semibold text-slate-950">Klistra in eller ladda upp CSV</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Kopiera rader från Excel/Sheets med rubrikrad först. Kontrollera preview innan du importerar.</p>
      <form action={runPasteImportAction} className="mt-5 grid gap-4">
        <Field label="Vad vill du importera?">
          <select name="target" defaultValue="staff" className={selectClassName}>
            {targets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
          </select>
        </Field>
        <Field label="Klistra in rader">
          <textarea name="pasted_text" className={textareaClassName} value={text} onChange={(event) => setText(event.target.value)} rows={9} />
        </Field>
        <Field label="Eller ladda upp CSV">
          <input name="file" type="file" accept=".csv,text/csv,text/plain" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </Field>

        {preview.headers.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">Preview</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead><tr>{preview.headers.map((header) => <th key={header} className="border-b border-slate-200 px-2 py-2 font-semibold text-slate-600">{header}</th>)}</tr></thead>
                <tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.headers.map((header, cellIndex) => <td key={`${header}-${cellIndex}`} className="border-b border-slate-100 px-2 py-2 text-slate-700">{row[cellIndex] ?? ''}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        ) : null}

        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Validera och importera</button>
      </form>
    </section>
  )
}

