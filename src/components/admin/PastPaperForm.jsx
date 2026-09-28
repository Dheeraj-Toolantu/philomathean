import { useState } from 'react'
import { FileUp, FileText, Lock, Unlock } from 'lucide-react'
import { createPaper, updatePaper } from '../../firebase/content'
import { getFreePdfUrl, removePdf, syncPdfPermission, uploadPdf } from '../../firebase/storage'
import { EXAM_SESSIONS, PAPER_TYPES, PAPER_YEARS, SUPPORTED_PATHWAYS, validatePaper } from '../../firebase/validation'

const empty = { title: '', pathway: SUPPORTED_PATHWAYS[0], subjectName: '', subjectCode: '', paperType: PAPER_TYPES[0], year: PAPER_YEARS[1], session: EXAM_SESSIONS[0], topic: '', access: 'premium', published: true }
const formatSize = (bytes) => bytes ? `${(bytes / 1048576).toFixed(1)} MB` : ''
const saveError = (error) => {
  if (error.message === 'CONFLICT') return 'Someone else changed this paper while you were editing. Close the panel and try again.'
  if (error.code === 'storage/no-default-bucket') return 'Firebase Storage is not initialized. Open the Firebase Storage console and click Get started.'
  return 'The PDF could not be saved. Check your connection and try again.'
}

export default function PastPaperForm({ user, editing, onSaved, onCancel, onBusyChange }) {
  const [values, setValues] = useState(editing ? { ...empty, ...editing, subjectCode: editing.subjectCode || '', topic: editing.topic || '', year: editing.year || empty.year, session: editing.session || empty.session } : empty)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState({})
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const change = (field, value) => { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => current[field] ? { ...current, [field]: undefined } : current) }
  const setWorking = (working) => { setBusy(working); onBusyChange?.(working) }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validatePaper(values, file)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setWorking(true)
    let uploadedPath
    try {
      const details = file ? await uploadPdf(file, editing?.id || crypto.randomUUID(), values.access, setProgress) : { filePath: values.filePath, fileName: values.fileName, fileSize: values.fileSize }
      uploadedPath = file ? details.filePath : undefined
      const published = values.published !== false
      await syncPdfPermission(details.filePath, values.access, published).catch(() => {})
      const freeDownloadUrl = values.access === 'free' ? await getFreePdfUrl(details.filePath).catch(() => null) : null
      if (editing) {
        await updatePaper(editing.id, { ...values, published }, user.uid, editing.version || 1, file ? details : {}, freeDownloadUrl)
        if (file && editing.filePath && editing.filePath !== details.filePath) await removePdf(editing.filePath).catch(() => {})
      } else {
        await createPaper({ ...values, published }, user.uid, details.filePath, details.fileName, details.fileSize, freeDownloadUrl)
      }
      onSaved(editing ? 'Past paper updated.' : 'Past paper uploaded.')
    } catch (error) {
      if (uploadedPath && uploadedPath !== editing?.filePath) await removePdf(uploadedPath).catch(() => {})
      setErrors({ form: saveError(error) })
    } finally {
      setWorking(false)
    }
  }

  const pickFile = (picked) => { if (picked) { setFile(picked); setErrors((current) => ({ ...current, file: undefined })) } }
  const field = (name, label, props = {}) => <label className="adm-field">{label}<input value={values[name]} onChange={(event) => change(name, event.target.value)} aria-invalid={Boolean(errors[name])} {...props} />{errors[name] && <small>{errors[name]}</small>}</label>

  return <form className="adm-form" onSubmit={submit} noValidate>
    <div className="adm-form-body">
      <section className="adm-form-section">
        <h3>Paper details</h3>
        {field('title', 'Title', { placeholder: 'IGCSE-MATHS - 0607-21 - May-June 2017' })}
        <label className="adm-field">Pathway<select value={values.pathway} onChange={(event) => change('pathway', event.target.value)}>{SUPPORTED_PATHWAYS.map((pathway) => <option key={pathway}>{pathway}</option>)}</select>{errors.pathway && <small>{errors.pathway}</small>}</label>
        <div className="adm-form-row">
          {field('subjectName', 'Subject', { placeholder: 'MATHEMATICS' })}
          {field('subjectCode', 'Syllabus code (optional)', { placeholder: '0607' })}
        </div>
      </section>

      <section className="adm-form-section">
        <h3>How students find it</h3>
        <div className="adm-segmented" role="radiogroup" aria-label="Paper type">
          {[['year-wise', 'Year-wise', 'By year & session'], ['topic-wise', 'Topic-wise', 'By topic']].map(([value, label, hint]) => <button type="button" role="radio" aria-checked={values.paperType === value} className={values.paperType === value ? 'active' : ''} key={value} onClick={() => change('paperType', value)}><b>{label}</b><small>{hint}</small></button>)}
        </div>
        {values.paperType === 'year-wise' ? <div className="adm-form-row">
          <label className="adm-field">Year<select value={values.year} onChange={(event) => change('year', Number(event.target.value))}>{PAPER_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select>{errors.year && <small>{errors.year}</small>}</label>
          <label className="adm-field">Exam session<select value={values.session} onChange={(event) => change('session', event.target.value)}>{EXAM_SESSIONS.map((session) => <option key={session}>{session}</option>)}</select>{errors.session && <small>{errors.session}</small>}</label>
        </div> : field('topic', 'Topic', { placeholder: 'Algebra' })}
      </section>

      <section className="adm-form-section">
        <h3>PDF file</h3>
        <label className={`adm-dropzone${dragging ? ' dragging' : ''}${errors.file ? ' invalid' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); pickFile(event.dataTransfer.files?.[0]) }}>
          <input type="file" accept="application/pdf,.pdf" onChange={(event) => pickFile(event.target.files?.[0])} />
          {file ? <><FileText size={24} /><b>{file.name}</b><small>{formatSize(file.size)} · click to choose a different file</small></>
            : values.fileName ? <><FileText size={24} /><b>{values.fileName}</b><small>Current file{values.fileSize ? ` · ${formatSize(values.fileSize)}` : ''} · drop a PDF to replace it</small></>
            : <><FileUp size={24} /><b>Drop a PDF here or click to browse</b><small>PDF only, up to 25 MB</small></>}
        </label>
        {errors.file && <small className="adm-field-error">{errors.file}</small>}
      </section>

      <section className="adm-form-section">
        <h3>Access</h3>
        <div className="adm-choice-grid" role="radiogroup" aria-label="Paper permission">
          <button type="button" role="radio" aria-checked={values.access === 'free'} className={`adm-choice${values.access === 'free' ? ' active' : ''}`} onClick={() => change('access', 'free')}><Unlock size={18} /><b>Free</b><small>Anyone can preview and download</small></button>
          <button type="button" role="radio" aria-checked={values.access === 'premium'} className={`adm-choice${values.access === 'premium' ? ' active' : ''}`} onClick={() => change('access', 'premium')}><Lock size={18} /><b>Premium</b><small>Listed, but the PDF stays locked</small></button>
        </div>
        <label className="adm-switch"><input type="checkbox" checked={values.published !== false} onChange={(event) => change('published', event.target.checked)} /><span aria-hidden="true" /><div><b>Show on website</b><small>Turn off to hide this paper from students</small></div></label>
      </section>
      {errors.form && <p className="adm-form-error" role="alert">{errors.form}</p>}
    </div>
    <footer className="adm-form-footer">
      {busy && file ? <div className="adm-progress"><span style={{ width: `${progress}%` }} /></div> : null}
      <button type="button" className="adm-button adm-button-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      <button className="adm-button adm-button-primary" disabled={busy}>{busy ? (file ? `Uploading ${progress}%` : 'Saving…') : editing ? 'Save changes' : 'Upload paper'}</button>
    </footer>
  </form>
}
