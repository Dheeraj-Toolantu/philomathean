import { useState } from 'react'
import { createResult, updateResult } from '../../firebase/content'
import { validateResult } from '../../firebase/validation'

const empty = { studentName: '', score: '', subjects: '', school: '', sortOrder: 0, published: true }
const pickFields = (values) => ({ studentName: values.studentName.trim(), score: values.score.trim(), subjects: values.subjects.trim(), school: values.school.trim(), sortOrder: values.sortOrder, published: values.published })

export default function ResultForm({ user, editing, onSaved, onCancel, onBusyChange }) {
  const [values, setValues] = useState(editing ? { ...empty, ...editing } : empty)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const change = (field, value) => { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => current[field] ? { ...current, [field]: undefined } : current) }
  const setWorking = (working) => { setBusy(working); onBusyChange?.(working) }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validateResult(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setWorking(true)
    try {
      if (editing) await updateResult(editing.id, pickFields(values), user.uid, editing.version || 1)
      else await createResult(pickFields(values), user.uid)
      onSaved(editing ? 'Result updated.' : 'Result added.')
    } catch (error) {
      setErrors({ form: error.message === 'CONFLICT' ? 'Someone else changed this result while you were editing. Close the panel and try again.' : 'The result could not be saved. Check your connection and try again.' })
    } finally {
      setWorking(false)
    }
  }

  const field = (name, label, props = {}) => <label className="adm-field">{label}<input value={values[name]} onChange={(event) => change(name, event.target.value)} aria-invalid={Boolean(errors[name])} {...props} />{errors[name] && <small>{errors[name]}</small>}</label>

  return <form className="adm-form" onSubmit={submit} noValidate>
    <div className="adm-form-body">
      <section className="adm-form-section">
        <h3>Student</h3>
        {field('studentName', 'Student name', { placeholder: 'Aarav Mehta' })}
        {field('school', 'School', { placeholder: 'Dhirubhai Ambani International School' })}
      </section>
      <section className="adm-form-section">
        <h3>Achievement</h3>
        <div className="adm-form-row">
          {field('score', 'Score', { placeholder: '45/45' })}
          {field('sortOrder', 'Display order', { type: 'number', min: 0 })}
        </div>
        {field('subjects', 'Subjects or examination details', { placeholder: 'IBDP · Maths AA HL (7), Physics HL (7)' })}
        <label className="adm-switch"><input type="checkbox" checked={values.published !== false} onChange={(event) => change('published', event.target.checked)} /><span aria-hidden="true" /><div><b>Show on website</b><small>Turn off to keep this result private</small></div></label>
      </section>
      {errors.form && <p className="adm-form-error" role="alert">{errors.form}</p>}
    </div>
    <footer className="adm-form-footer">
      <button type="button" className="adm-button adm-button-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      <button className="adm-button adm-button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add result'}</button>
    </footer>
  </form>
}
