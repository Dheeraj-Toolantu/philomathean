import { useEffect, useState } from 'react'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { MAX_IMAGE_BYTES, uploadQuestionImage } from '../../firebase/questionBanks'
import { cleanQuestion, LETTERS, MAX_OPTIONS, validateQuestion } from '../../student/questionTools'

const DIFFICULTIES = [[1, 'Foundation', 'Revision Ladder level 1'], [2, 'Exam standard', 'Level 2 · used in predictions'], [3, 'Challenge', 'Level 3 · top grades']]

// Add or edit one question. The image is uploaded only when the question is saved.
export default function QuestionForm({ bankId, question, onSave, onCancel, onBusyChange }) {
  const [values, setValues] = useState(question)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const change = (field, value) => { setValues((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, form: undefined })) }
  const setOption = (index, value) => change('options', values.options.map((option, i) => i === index ? value : option))
  const addOption = () => change('options', [...values.options, ''])
  const removeOption = (index) => {
    const options = values.options.filter((_, i) => i !== index)
    setValues((current) => ({ ...current, options, answer: current.answer === index ? 0 : current.answer > index ? current.answer - 1 : current.answer }))
  }
  const pickImage = (event) => {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!next.type.startsWith('image/')) return setErrors((current) => ({ ...current, image: 'Choose an image file (PNG, JPG, WebP or SVG).' }))
    if (next.size > MAX_IMAGE_BYTES) return setErrors((current) => ({ ...current, image: 'The image must be 5 MB or smaller.' }))
    setFile(next); setPreview(URL.createObjectURL(next)); setErrors((current) => ({ ...current, image: undefined }))
  }
  const removeImage = () => { setFile(null); setPreview(''); setValues((current) => ({ ...current, imageUrl: '', removedImagePath: current.imagePath || current.removedImagePath, imagePath: '' })) }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validateQuestion(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true); onBusyChange?.(true)
    try {
      let next = { ...values }
      if (file) {
        const uploaded = await uploadQuestionImage(bankId, values.id, file)
        next = { ...next, ...uploaded, removedImagePath: values.imagePath || values.removedImagePath }
      }
      await onSave(cleanQuestion(next), next.removedImagePath)
    } catch (error) {
      setErrors({ form: error.message === 'BANK_CHANGED' ? 'Someone else changed this bank while you were editing. Close the panel, reload and try again.' : 'The question could not be saved. Check your connection and try again.' })
    } finally {
      setBusy(false); onBusyChange?.(false)
    }
  }

  const image = preview || values.imageUrl
  return <form className="adm-form" onSubmit={submit} noValidate>
    <div className="adm-form-body">
      <section className="adm-form-section">
        <h3>Question</h3>
        <label className="adm-field">Question text<textarea rows={4} value={values.prompt} onChange={(event) => change('prompt', event.target.value)} aria-invalid={Boolean(errors.prompt)} placeholder="e.g. Find the sum of the first 15 terms of 3 + 8 + 13 + …" />{errors.prompt && <small>{errors.prompt}</small>}</label>
        <div className="adm-field">Diagram (optional)
          {image ? <div className="adm-question-image"><img src={image} alt="Question diagram preview" /><button type="button" className="adm-icon-button adm-icon-danger" onClick={removeImage} aria-label="Remove image"><X size={16} /></button></div>
            : <label className="adm-dropzone adm-dropzone-compact"><ImagePlus size={20} /><b>Add an image</b><small>PNG, JPG, WebP or SVG · up to 5 MB</small><input type="file" accept="image/*" onChange={pickImage} className="sr-only" /></label>}
          {errors.image && <small>{errors.image}</small>}
        </div>
      </section>

      <section className="adm-form-section">
        <h3>Answer options</h3>
        <p className="adm-hint">Select the correct answer. Options are shuffled for students on every attempt.</p>
        <div className="adm-options" role="radiogroup" aria-label="Correct answer">
          {values.options.map((option, index) => <div key={index} className={values.answer === index ? 'adm-option correct' : 'adm-option'}>
            <label className="adm-option-radio" title="Mark as correct"><input type="radio" name="correct" checked={values.answer === index} onChange={() => change('answer', index)} /><span>{LETTERS[index]}</span></label>
            <input value={option} onChange={(event) => setOption(index, event.target.value)} placeholder={`Option ${LETTERS[index]}`} aria-label={`Option ${LETTERS[index]}`} />
            {values.options.length > 2 && <button type="button" className="adm-icon-button" onClick={() => removeOption(index)} aria-label={`Remove option ${LETTERS[index]}`}><Trash2 size={15} /></button>}
          </div>)}
        </div>
        {values.options.length < MAX_OPTIONS && <button type="button" className="adm-button adm-button-ghost adm-button-small" onClick={addOption}><Plus size={15} /> Add option</button>}
        {(errors.options || errors.answer) && <small className="adm-field-error">{errors.options || errors.answer}</small>}
        <label className="adm-field">Worked explanation (shown after answering)<textarea rows={3} value={values.explain} onChange={(event) => change('explain', event.target.value)} aria-invalid={Boolean(errors.explain)} placeholder="Show the method in one or two lines." />{errors.explain && <small>{errors.explain}</small>}</label>
      </section>

      <section className="adm-form-section">
        <h3>Where it appears</h3>
        <div className="adm-segmented adm-segmented-3" role="radiogroup" aria-label="Difficulty">{DIFFICULTIES.map(([level, label, hint]) => <button key={level} type="button" role="radio" aria-checked={Number(values.difficulty) === level} className={Number(values.difficulty) === level ? 'active' : ''} onClick={() => change('difficulty', level)}><b>{label}</b><small>{hint}</small></button>)}</div>
        <label className="adm-switch"><input type="checkbox" checked={values.prediction} onChange={(event) => change('prediction', event.target.checked)} /><span aria-hidden="true" /><div><b>Pick for the Prediction Exam</b><small>When any question in a course is picked, its Prediction Exam uses only picked questions</small></div></label>
        <label className="adm-switch"><input type="checkbox" checked={!values.hidden} onChange={(event) => change('hidden', !event.target.checked)} /><span aria-hidden="true" /><div><b>Show to students</b><small>Turn off to keep this question as a draft</small></div></label>
      </section>
      {errors.form && <p className="adm-form-error" role="alert">{errors.form}</p>}
    </div>
    <footer className="adm-form-footer">
      <button type="button" className="adm-button adm-button-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      <button className="adm-button adm-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save question'}</button>
    </footer>
  </form>
}
