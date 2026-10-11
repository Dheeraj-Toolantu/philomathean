import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, FileUp, Image as ImageIcon, KeyRound, ScanLine } from 'lucide-react'
import { uploadQuestionImage } from '../../../firebase/questionBanks'
import { cleanQuestion, LETTERS, newQuestionId, validateQuestion } from '../../../student/questionTools'
import { extractQuestions, readAnswerKey } from './engine'
import { parseAnswerKey } from './layout'

const DIFFICULTY = [[1, 'Foundation'], [2, 'Exam standard'], [3, 'Challenge']]
const IMAGE_PROMPT = 'Study the question shown and choose the correct answer.'

// One review card per extracted question. `mode` is 'text' (stem + options as text, diagram attached)
// or 'image' (the whole question as a picture, options A–D) for layouts the text extraction can't handle.
const toDraft = (question, answers, difficulty) => {
  const letters = question.options.length >= 2 ? question.options.map((option) => option.letter) : ['A', 'B', 'C', 'D']
  const textOptions = question.options.length >= 2 && !question.pictureOptions
  const answerLetter = answers[question.number]
  const mode = textOptions || question.pictureOptions ? 'text' : 'image'
  return {
    key: question.number, number: question.number, pages: [...new Set(question.segments.map((segment) => segment.pageIndex + 1))],
    include: question.options.length >= 2,
    mode,
    prompt: question.stem || (mode === 'image' ? IMAGE_PROMPT : ''),
    options: textOptions ? question.options.map((option) => option.text) : letters,
    answer: answerLetter ? letters.indexOf(answerLetter) : -1,
    difficulty,
    useFigure: Boolean(question.figure),
    figure: question.figure, whole: question.whole,
    pictureOptions: question.pictureOptions, noOptions: question.options.length < 2,
  }
}
const draftToQuestion = (draft) => cleanQuestion({ id: newQuestionId(), prompt: draft.prompt, options: draft.options, answer: draft.answer, difficulty: draft.difficulty, explain: '' })

export default function PdfImport({ bankId, bankTitle, onImport, onClose, onBusyChange }) {
  const [step, setStep] = useState('select')
  const [paper, setPaper] = useState(null)
  const [scheme, setScheme] = useState(null)
  const [pasted, setPasted] = useState('')
  const [difficulty, setDifficulty] = useState(2)
  const [progress, setProgress] = useState({ label: '', value: 0 })
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [drafts, setDrafts] = useState([])
  const [pageCount, setPageCount] = useState(0)

  const busy = step === 'processing' || step === 'importing'
  const update = (key, patch) => setDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, ...patch } : draft))
  const setMode = (draft, mode) => update(draft.key, mode === 'image'
    ? { mode, options: draft.options.map((_, index) => LETTERS[index]), prompt: draft.prompt || IMAGE_PROMPT }
    : { mode })

  const analyse = async () => {
    setError(''); setStep('processing'); onBusyChange?.(true)
    try {
      const answers = scheme ? await readAnswerKey(scheme) : parseAnswerKey(pasted)
      const result = await extractQuestions(paper, { onProgress: (label, value) => setProgress({ label, value }) })
      setWarnings(result.warnings); setPageCount(result.pageCount)
      setDrafts(result.questions.map((question) => toDraft(question, answers, difficulty)))
      setStep('review')
    } catch (failure) {
      console.error(failure)
      setError(failure?.name === 'PasswordException' ? 'This PDF is password-protected. Remove the password and try again.' : 'The PDF could not be read. Make sure it is a valid, unprotected PDF.')
      setStep('select')
    } finally { onBusyChange?.(false) }
  }

  const included = drafts.filter((draft) => draft.include)
  const problems = Object.fromEntries(included.map((draft) => [draft.key, Object.values(validateQuestion(draftToQuestion(draft)))]))
  const invalid = included.filter((draft) => problems[draft.key]?.length)

  const save = async () => {
    setStep('importing'); onBusyChange?.(true); setError('')
    try {
      const questions = []
      for (const [index, draft] of included.entries()) {
        setProgress({ label: `Uploading question ${index + 1} of ${included.length}`, value: (index + 1) / included.length })
        const question = draftToQuestion(draft)
        const image = draft.mode === 'image' ? draft.whole : draft.useFigure ? draft.figure : null
        if (image?.blob) Object.assign(question, await uploadQuestionImage(bankId, question.id, new File([image.blob], `q${draft.number}.png`, { type: 'image/png' })))
        questions.push(question)
      }
      await onImport(questions)
    } catch (failure) {
      console.error(failure)
      setError(failure.message === 'BANK_CHANGED' ? 'Someone else changed this bank meanwhile. Close this panel, reload and import again.' : 'The questions could not be saved. Check your connection and the Firebase rules, then try again.')
      setStep('review')
    } finally { onBusyChange?.(false) }
  }

  if (step === 'select' || step === 'processing') return <div className="adm-form">
    <div className="adm-form-body">
      <section className="adm-form-section">
        <h3>1 · Question paper</h3>
        <p className="adm-hint">A multiple-choice paper PDF with selectable text, such as Cambridge Paper 1. Questions should be numbered 1, 2, 3… with options A–D. Diagrams, graphs, photos and picture options are cropped automatically.</p>
        <FilePick file={paper} onFile={setPaper} icon={FileText} label="Choose question paper PDF" disabled={busy} />
      </section>
      <section className="adm-form-section">
        <h3>2 · Answers (optional)</h3>
        <p className="adm-hint">Add the mark scheme PDF, or paste the answers (for example <code>1 B, 2 C, 3 A</code> or <code>BCAD…</code>). You can also pick answers on the review screen.</p>
        <FilePick file={scheme} onFile={setScheme} icon={KeyRound} label="Choose mark scheme PDF" disabled={busy} />
        {!scheme && <label className="adm-field">…or paste the answers<textarea rows={2} value={pasted} onChange={(event) => setPasted(event.target.value)} disabled={busy} placeholder="1 B, 2 C, 3 A…" /></label>}
      </section>
      <section className="adm-form-section">
        <h3>3 · Default difficulty</h3>
        <div className="adm-segmented adm-segmented-3" role="radiogroup" aria-label="Default difficulty">{DIFFICULTY.map(([level, label]) => <button key={level} type="button" role="radio" aria-checked={difficulty === level} className={difficulty === level ? 'active' : ''} onClick={() => setDifficulty(level)} disabled={busy}><b>{label}</b></button>)}</div>
      </section>
      {step === 'processing' && <div className="adm-pdf-progress" role="status"><ScanLine size={18} /><div><b>{progress.label || 'Opening PDF…'}</b><span className="adm-progress"><span style={{ width: `${Math.round(progress.value * 100)}%` }} /></span></div></div>}
      {error && <p className="adm-form-error" role="alert">{error}</p>}
    </div>
    <footer className="adm-form-footer">
      <button type="button" className="adm-button adm-button-ghost" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="button" className="adm-button adm-button-primary" onClick={analyse} disabled={!paper || busy}>{busy ? 'Reading PDF…' : 'Extract questions'}</button>
    </footer>
  </div>

  const withAnswers = drafts.filter((draft) => draft.answer >= 0).length
  const withImages = drafts.filter((draft) => draft.figure).length
  return <div className="adm-form">
    <div className="adm-form-body">
      <div className="adm-pdf-summary">
        <span><b>{drafts.length}</b> questions found in {pageCount} pages</span>
        <span><b>{withAnswers}</b> with answers</span>
        <span><b>{withImages}</b> with diagrams</span>
        <span className="adm-pdf-target">Importing into <b>{bankTitle}</b></span>
      </div>
      {warnings.map((warning) => <p key={warning} className="adm-form-error"><AlertTriangle size={15} /> {warning}</p>)}
      {drafts.length > 0 && <div className="adm-pdf-bulk">
        <button type="button" className="adm-button adm-button-ghost adm-button-small" onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, include: true })))}>Select all</button>
        <button type="button" className="adm-button adm-button-ghost adm-button-small" onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, include: false })))}>Select none</button>
        <label className="adm-pdf-inline">Difficulty for selected
          <select onChange={(event) => { const level = Number(event.target.value); if (level) setDrafts((current) => current.map((draft) => draft.include ? { ...draft, difficulty: level } : draft)); event.target.value = '' }} defaultValue="">
            <option value="">Change…</option>{DIFFICULTY.map(([level, label]) => <option key={level} value={level}>{label}</option>)}
          </select></label>
      </div>}
      <ol className="adm-pdf-list">{drafts.map((draft) => {
        const issues = draft.include ? problems[draft.key] || [] : []
        const preview = draft.mode === 'image' ? draft.whole : draft.useFigure ? draft.figure : null
        return <li key={draft.key} className={draft.include ? (issues.length ? 'adm-pdf-card invalid' : 'adm-pdf-card') : 'adm-pdf-card excluded'}>
          <header>
            <label className="adm-pdf-include"><input type="checkbox" checked={draft.include} onChange={(event) => update(draft.key, { include: event.target.checked })} /> <b>Question {draft.number}</b></label>
            <small>Page {draft.pages.join('–')}</small>
            {draft.figure && <span className="adm-badge adm-badge-order"><ImageIcon size={12} /> Diagram</span>}
            {draft.pictureOptions && <span className="adm-badge adm-badge-order">Picture options</span>}
            {draft.noOptions && <span className="adm-badge adm-badge-hidden">No options found</span>}
            {draft.answer < 0 && <span className="adm-badge adm-badge-premium">Answer needed</span>}
            <div className="adm-segmented adm-pdf-mode" role="radiogroup" aria-label="Import as">
              <button type="button" role="radio" aria-checked={draft.mode === 'text'} className={draft.mode === 'text' ? 'active' : ''} onClick={() => setMode(draft, 'text')}><b>Text + diagram</b></button>
              <button type="button" role="radio" aria-checked={draft.mode === 'image'} className={draft.mode === 'image' ? 'active' : ''} onClick={() => setMode(draft, 'image')}><b>Whole question as image</b></button>
            </div>
          </header>
          <div className="adm-pdf-body">
            <div className="adm-pdf-preview">
              {preview ? <img src={preview.url} alt={`Question ${draft.number} ${draft.mode === 'image' ? 'image' : 'diagram'}`} /> : <span>No image</span>}
              {draft.mode === 'text' && draft.figure && <label className="adm-pdf-inline"><input type="checkbox" checked={draft.useFigure} onChange={(event) => update(draft.key, { useFigure: event.target.checked })} /> Attach diagram</label>}
            </div>
            <div className="adm-pdf-fields">
              <label className="adm-field">Question text<textarea rows={draft.mode === 'image' ? 2 : 3} value={draft.prompt} onChange={(event) => update(draft.key, { prompt: event.target.value })} /></label>
              <div className="adm-options">{draft.options.map((option, index) => <div key={index} className={draft.answer === index ? 'adm-option correct' : 'adm-option'}>
                <label className="adm-option-radio" title="Mark as correct"><input type="radio" name={`answer-${draft.key}`} checked={draft.answer === index} onChange={() => update(draft.key, { answer: index })} /><span>{LETTERS[index]}</span></label>
                <input value={option} onChange={(event) => update(draft.key, { options: draft.options.map((item, i) => i === index ? event.target.value : item) })} aria-label={`Question ${draft.number} option ${LETTERS[index]}`} />
              </div>)}</div>
              <label className="adm-pdf-inline">Difficulty <select value={draft.difficulty} onChange={(event) => update(draft.key, { difficulty: Number(event.target.value) })}>{DIFFICULTY.map(([level, label]) => <option key={level} value={level}>{label}</option>)}</select></label>
              {issues.length > 0 && <small className="adm-field-error">{issues.join(' ')}</small>}
            </div>
          </div>
        </li>
      })}</ol>
      {step === 'importing' && <div className="adm-pdf-progress" role="status"><FileUp size={18} /><div><b>{progress.label}</b><span className="adm-progress"><span style={{ width: `${Math.round(progress.value * 100)}%` }} /></span></div></div>}
      {error && <p className="adm-form-error" role="alert">{error}</p>}
    </div>
    <footer className="adm-form-footer">
      <button type="button" className="adm-button adm-button-ghost" onClick={() => setStep('select')} disabled={busy}>Back</button>
      <span className="adm-pdf-footnote">{invalid.length ? <><AlertTriangle size={14} /> {invalid.length} selected question{invalid.length === 1 ? ' needs' : 's need'} fixing</> : included.length ? <><CheckCircle2 size={14} /> Ready</> : null}</span>
      <button type="button" className="adm-button adm-button-primary" onClick={save} disabled={busy || !included.length || invalid.length > 0}>{step === 'importing' ? 'Importing…' : `Import ${included.length} question${included.length === 1 ? '' : 's'}`}</button>
    </footer>
  </div>
}

function FilePick({ file, onFile, icon: Icon, label, disabled }) {
  return <label className={file ? 'adm-dropzone adm-dropzone-compact has-file' : 'adm-dropzone adm-dropzone-compact'}>
    <Icon size={20} />
    <b>{file ? file.name : label}</b>
    <small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · click to change` : 'PDF up to 50 MB'}</small>
    <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={disabled} onChange={(event) => { const next = event.target.files?.[0]; event.target.value = ''; if (next && next.size <= 50 * 1024 * 1024) onFile(next) }} />
  </label>
}
