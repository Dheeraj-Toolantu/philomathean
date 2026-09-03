import { useState } from 'react'
import { createResult, updateResult } from '../../firebase/content'
import { validateResult } from '../../firebase/validation'

const empty = { studentName: '', score: '', subjects: '', school: '', sortOrder: 0, published: true }
export default function ResultForm({ user, editing, onSaved, onCancel }) {
  const [values, setValues] = useState(editing ? { ...empty, ...editing } : empty)
  const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false)
  const change = (field, value) => setValues((current) => ({ ...current, [field]: value }))
  const submit = async (event) => { event.preventDefault(); const nextErrors = validateResult(values); setErrors(nextErrors); if (Object.keys(nextErrors).length) return; setBusy(true); try { if (editing) await updateResult(editing.id, values, user.uid, editing.version || 1); else await createResult(values, user.uid); setValues(empty); onSaved() } catch { setErrors({ form: 'The result could not be saved. Refresh and try again.' }) } finally { setBusy(false) } }
  return <form className="admin-form" onSubmit={submit}><h3>{editing ? 'Edit result' : 'Add student result'}</h3>{[['studentName', 'Student name'], ['score', 'Score (for example 45/45)'], ['subjects', 'Subjects or examination details'], ['school', 'School']].map(([field, label]) => <label key={field}>{label}<input value={values[field]} onChange={(event) => change(field, event.target.value)} />{errors[field] && <small>{errors[field]}</small>}</label>)}<label>Display order<input type="number" min="0" value={values.sortOrder} onChange={(event) => change('sortOrder', event.target.value)} /></label><label className="admin-check"><input type="checkbox" checked={values.published} onChange={(event) => change('published', event.target.checked)} /> Publish on website</label>{errors.form && <p className="admin-error">{errors.form}</p>}<div className="admin-form-actions"><button className="orange-button" disabled={busy}>{busy ? 'Saving...' : 'Save result'}</button>{editing && <button className="outline-button" type="button" onClick={onCancel}>Cancel</button>}</div></form>
}
