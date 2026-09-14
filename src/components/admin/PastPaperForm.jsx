import { useState } from 'react'
import { createPaper, updatePaper } from '../../firebase/content'
import { removePdf, uploadPdf } from '../../firebase/storage'
import { EXAM_SESSIONS, PAPER_TYPES, PAPER_YEARS, SUPPORTED_PATHWAYS, validatePaper } from '../../firebase/validation'

const empty = { title: '', pathway: SUPPORTED_PATHWAYS[0], subjectName: '', subjectCode: '', paperType: PAPER_TYPES[0], year: PAPER_YEARS[0], session: EXAM_SESSIONS[0], topic: '', access: 'premium', published: true }
export default function PastPaperForm({ user, editing, onSaved, onCancel }) {
  const [values, setValues] = useState(editing ? { ...empty, ...editing } : empty); const [file, setFile] = useState(null); const [errors, setErrors] = useState({}); const [progress, setProgress] = useState(0); const [busy, setBusy] = useState(false)
  const submit = async (event) => { event.preventDefault(); const nextErrors = validatePaper(values, file); setErrors(nextErrors); if (Object.keys(nextErrors).length) return; setBusy(true); let uploadedPath; try { const resourceId = editing?.id || crypto.randomUUID(); const details = file ? await uploadPdf(file, resourceId, values.access, setProgress) : { filePath: values.filePath, fileName: values.fileName, fileSize: values.fileSize }; uploadedPath = file ? details.filePath : undefined; if (editing) await updatePaper(editing.id, values, user.uid, editing.version || 1, details); else await createPaper(values, user.uid, details.filePath, details.fileName, details.fileSize); setValues(empty); setFile(null); setProgress(0); onSaved() } catch (uploadError) { if (uploadedPath && !editing) await removePdf(uploadedPath).catch(() => {}) ; setErrors({ form: uploadError.code === 'storage/no-default-bucket' ? 'Firebase Storage is not initialized. Open the Firebase Storage console and click Get started.' : 'The PDF could not be saved. Check Firebase Storage and Firestore rules, then try again.' }) } finally { setBusy(false) } }
  return <form className="admin-form" onSubmit={submit}>
    <h3>{editing ? 'Edit past paper' : 'Upload past paper'}</h3>
    <label>Title<input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />{errors.title && <small>{errors.title}</small>}</label>
    <label>Pathway<select value={values.pathway} onChange={(event) => setValues({ ...values, pathway: event.target.value })}>{SUPPORTED_PATHWAYS.map((pathway) => <option key={pathway}>{pathway}</option>)}</select>{errors.pathway && <small>{errors.pathway}</small>}</label>
    <div className="admin-form-row">
      <label>Subject name<input value={values.subjectName} onChange={(event) => setValues({ ...values, subjectName: event.target.value })} placeholder="Mathematics" />{errors.subjectName && <small>{errors.subjectName}</small>}</label>
      <label>Syllabus code (optional)<input value={values.subjectCode} onChange={(event) => setValues({ ...values, subjectCode: event.target.value })} placeholder="0580" /></label>
    </div>
    <fieldset className="admin-access"><legend>Paper type</legend><label><input type="radio" name="paperType" value="year-wise" checked={values.paperType === 'year-wise'} onChange={(event) => setValues({ ...values, paperType: event.target.value })} /> Year-wise (grouped by year &amp; session)</label><label><input type="radio" name="paperType" value="topic-wise" checked={values.paperType === 'topic-wise'} onChange={(event) => setValues({ ...values, paperType: event.target.value })} /> Topic-wise (grouped by topic)</label>{errors.paperType && <small>{errors.paperType}</small>}</fieldset>
    {values.paperType === 'year-wise' ? <div className="admin-form-row">
      <label>Year<select value={values.year} onChange={(event) => setValues({ ...values, year: Number(event.target.value) })}>{PAPER_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select>{errors.year && <small>{errors.year}</small>}</label>
      <label>Exam session<select value={values.session} onChange={(event) => setValues({ ...values, session: event.target.value })}>{EXAM_SESSIONS.map((session) => <option key={session}>{session}</option>)}</select>{errors.session && <small>{errors.session}</small>}</label>
    </div> : <label>Topic<input value={values.topic} onChange={(event) => setValues({ ...values, topic: event.target.value })} placeholder="Algebra" />{errors.topic && <small>{errors.topic}</small>}</label>}
    <fieldset className="admin-access"><legend>Paper permission</legend><label><input type="radio" name="access" value="free" checked={values.access === 'free'} onChange={(event) => setValues({ ...values, access: event.target.value })} /> Free, preview and download</label><label><input type="radio" name="access" value="premium" checked={values.access === 'premium'} onChange={(event) => setValues({ ...values, access: event.target.value })} /> Premium, blurred preview only</label>{errors.access && <small>{errors.access}</small>}</fieldset>
    <label>PDF file<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />{errors.file && <small>{errors.file}</small>}</label>
    <label className="admin-check"><input type="checkbox" checked={values.published} onChange={(event) => setValues({ ...values, published: event.target.checked })} /> Publish on website</label>
    {busy && <progress max="100" value={progress}>{progress}%</progress>}
    {errors.form && <p className="admin-error">{errors.form}</p>}
    <div className="admin-form-actions"><button className="orange-button" disabled={busy}>{busy ? `Saving ${progress}%` : 'Save past paper'}</button>{editing && <button className="outline-button" type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>
}
