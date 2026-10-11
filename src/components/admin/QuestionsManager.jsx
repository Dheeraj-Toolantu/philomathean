import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CircleHelp, Download, Eye, EyeOff, FileUp, Image, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { loadManagedBanks, removeQuestionImage, resetBank, saveBank } from '../../firebase/questionBanks'
import { COURSES, coursesUsingBank } from '../../student/catalog'
import { blankQuestion, builtInQuestions, CSV_TEMPLATE, LETTERS, questionsFromCsv } from '../../student/questionTools'
import { ConfirmDialog, Drawer, EmptyState, SkeletonRows } from './AdminUI'
import QuestionForm from './QuestionForm'

const DIFFICULTY = { 1: 'Foundation', 2: 'Exam standard', 3: 'Challenge' }
const download = (name, text) => { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const link = Object.assign(document.createElement('a'), { href: url, download: name }); link.click(); URL.revokeObjectURL(url) }
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
const toCsv = (questions) => {
  const width = Math.max(4, ...questions.map((question) => question.options.length))
  const header = ['question', ...Array.from({ length: width }, (_, i) => `option_${LETTERS[i].toLowerCase()}`), 'correct', 'explanation', 'difficulty']
  return [header.join(','), ...questions.map((question) => [question.prompt, ...Array.from({ length: width }, (_, i) => question.options[i] || ''), LETTERS[question.answer], question.explain, question.difficulty].map(csvCell).join(','))].join('\n')
}

// Every question students see in Topic Quizzes, the Revision Ladder, Mock Exams, Prediction Exams and
// "Build my Exam" comes from these banks. Banks never edited here use the built-in starter questions.
export default function QuestionsManager({ user, notify }) {
  const [managed, setManaged] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [courseId, setCourseId] = useState(COURSES[0].id)
  const course = COURSES.find((item) => item.id === courseId)
  const banks = useMemo(() => course.topics.flatMap((topic) => topic.quizzes.map((quiz) => ({ ...quiz, topic }))), [course])
  const [bankId, setBankId] = useState(banks[0].bank)
  const bank = banks.find((item) => item.bank === bankId) || banks[0]
  const [drawer, setDrawer] = useState(null)
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [importer, setImporter] = useState(null)

  const fetchBanks = useCallback(() => loadManagedBanks().then(setManaged).catch(() => setLoadError(true)), [])
  useEffect(() => { fetchBanks() }, [fetchBanks])
  const load = () => { setLoadError(false); fetchBanks() }

  const record = managed?.[bank.bank]
  const isManaged = Boolean(record)
  const questions = record ? record.questions || [] : builtInQuestions(bank.bank)
  const usedIn = coursesUsingBank(bank.bank).map((item) => item.title)
  const pickCourse = (id) => { setCourseId(id); const first = COURSES.find((item) => item.id === id).topics[0].quizzes[0].bank; setBankId(first) }

  // Every change saves the whole bank. The first change to a built-in bank copies it into Firestore.
  const commit = async (next, message) => {
    const version = await saveBank(bank.bank, next, record?.version || 0, user)
    setManaged((current) => ({ ...current, [bank.bank]: { ...(current?.[bank.bank] || {}), questions: next, version, updatedAt: new Date(), updatedBy: user.email } }))
    if (message) notify('success', message)
  }
  const run = async (action) => {
    setBusy(true)
    try { await action() } catch (error) {
      notify('error', error.message === 'BANK_CHANGED' ? 'Someone else changed this bank. Reloading the latest version.' : 'The change could not be saved. Check your connection and the Firestore rules.')
      if (error.message === 'BANK_CHANGED') load()
    } finally { setBusy(false) }
  }
  const saveQuestion = async (question, removedImagePath) => {
    const exists = questions.some((item) => item.id === question.id)
    await commit(exists ? questions.map((item) => item.id === question.id ? question : item) : [...questions, question], exists ? 'Question updated.' : 'Question added.')
    if (removedImagePath && removedImagePath !== question.imagePath) removeQuestionImage(removedImagePath)
    setDrawer(null)
  }
  const move = (index, step) => run(() => { const next = [...questions]; [next[index], next[index + step]] = [next[index + step], next[index]]; return commit(next) })
  const toggleHidden = (question) => run(() => commit(questions.map((item) => item.id === question.id ? { ...item, hidden: !item.hidden } : item), question.hidden ? 'Question is visible to students.' : 'Question hidden from students.'))
  const remove = () => run(async () => {
    if (confirm.kind === 'reset') { await resetBank(bank.bank, questions); setManaged((current) => { const next = { ...current }; delete next[bank.bank]; return next }); notify('success', 'This bank is back to the built-in questions.') }
    else { await commit(questions.filter((item) => item.id !== confirm.question.id), 'Question deleted.'); removeQuestionImage(confirm.question.imagePath) }
    setConfirm(null)
  })
  const startManaging = () => run(() => commit(questions, 'Built-in questions copied. You can now edit them.'))

  const visible = questions.filter((question) => !question.hidden).length
  const predictionPicks = questions.filter((question) => question.prediction).length

  return <section className="adm-panel">
    <header className="adm-panel-head">
      <div><h2>Question bank</h2><p>Questions for Topic Quizzes, Revision Ladder, Mock Exams, Prediction Exams and “Build my Exam”. Changes go live for students straight away.</p></div>
    </header>
    <div className="adm-toolbar">
      <span className="adm-toolbar-label">Course</span>
      <select value={courseId} onChange={(event) => pickCourse(event.target.value)} aria-label="Course">{COURSES.map((item) => <option key={item.id} value={item.id}>{item.title}{item.tier === 'premium' ? ' · Gold' : ''}</option>)}</select>
    </div>

    {loadError ? <EmptyState icon={CircleHelp} title="Question banks could not be loaded" message="Check your connection and that the Firestore rules are deployed." action={<button type="button" className="adm-button adm-button-ghost" onClick={load}>Try again</button>} />
      : !managed ? <SkeletonRows count={5} />
      : <div className="adm-qb">
        <nav className="adm-qb-banks" aria-label="Question banks">
          {course.topics.map((topic) => <div key={topic.id} className="adm-qb-topic">
            <h4>Topic {topic.number} · {topic.title}</h4>
            {topic.quizzes.map((quiz) => {
              const own = managed[quiz.bank]
              const count = own ? (own.questions || []).filter((question) => !question.hidden).length : builtInQuestions(quiz.bank).length
              return <button key={quiz.bank} type="button" className={quiz.bank === bank.bank ? 'active' : ''} onClick={() => setBankId(quiz.bank)}>
                <span>{quiz.title}</span><small>{count} live{own ? '' : ' · built-in'}</small>
              </button>
            })}
          </div>)}
        </nav>

        <div className="adm-qb-main">
          <div className="adm-qb-head">
            <div>
              <h3>{bank.title} <span className={isManaged ? 'adm-badge adm-badge-free' : 'adm-badge adm-badge-hidden'}>{isManaged ? 'Managed here' : 'Built-in questions'}</span></h3>
              <p>{visible} visible · {questions.length - visible} hidden{predictionPicks ? ` · ${predictionPicks} picked for prediction` : ''}{usedIn.length > 1 ? ` · shared by ${usedIn.join(', ')}` : ''}</p>
              {record?.updatedBy && <p className="adm-muted">Last edited by {record.updatedBy}{record.updatedAt ? ` on ${record.updatedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p>}
            </div>
            <div className="adm-qb-actions">
              <button type="button" className="adm-button adm-button-primary" disabled={busy} onClick={() => setDrawer({ question: blankQuestion() })}><Plus size={16} /> Add question</button>
              <button type="button" className="adm-button adm-button-ghost" disabled={busy} onClick={() => setImporter({ text: '', mode: 'append' })}><FileUp size={16} /> Import CSV</button>
              <button type="button" className="adm-button adm-button-ghost" onClick={() => download(`${bank.bank}.csv`, toCsv(questions))}><Download size={16} /> Export</button>
              {!isManaged && <button type="button" className="adm-button adm-button-ghost" disabled={busy} onClick={startManaging}><Sparkles size={16} /> Copy built-in to edit</button>}
              {isManaged && <button type="button" className="adm-button adm-button-ghost adm-text-danger" disabled={busy} onClick={() => setConfirm({ kind: 'reset' })}><RotateCcw size={16} /> Reset to built-in</button>}
            </div>
          </div>
          {!isManaged && <p className="adm-note">These are the website’s built-in starter questions. Editing, adding or importing copies them here first, and from then on this bank is fully managed from this panel.</p>}

          {!questions.length ? <EmptyState icon={CircleHelp} title="No questions in this bank" message="Students see “No questions yet” for this quiz. Add a question or import a CSV." />
            : <ol className="adm-qb-list">{questions.map((question, index) => <li key={question.id} className={question.hidden ? 'adm-qb-item hidden' : 'adm-qb-item'}>
              <span className="adm-qb-num">{index + 1}</span>
              <div className="adm-qb-body">
                <p>{question.prompt}</p>
                <div className="adm-badges">
                  <span className={`adm-badge adm-diff-${question.difficulty}`}>{DIFFICULTY[question.difficulty]}</span>
                  <span className="adm-badge adm-badge-order">Answer {LETTERS[question.answer]}: {question.options[question.answer]}</span>
                  {question.prediction && <span className="adm-badge adm-badge-premium">Prediction pick</span>}
                  {question.imageUrl && <span className="adm-badge adm-badge-order"><Image size={12} /> Diagram</span>}
                  {question.hidden && <span className="adm-badge adm-badge-hidden">Hidden</span>}
                </div>
              </div>
              <div className="adm-row-actions">
                <button type="button" className="adm-icon-button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move up" title="Move up"><ArrowUp size={15} /></button>
                <button type="button" className="adm-icon-button" disabled={busy || index === questions.length - 1} onClick={() => move(index, 1)} aria-label="Move down" title="Move down"><ArrowDown size={15} /></button>
                <button type="button" className="adm-icon-button" disabled={busy} onClick={() => toggleHidden(question)} aria-label={question.hidden ? 'Show to students' : 'Hide from students'} title={question.hidden ? 'Show to students' : 'Hide from students'}>{question.hidden ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                <button type="button" className="adm-icon-button" disabled={busy} onClick={() => setDrawer({ question })} aria-label="Edit question" title="Edit"><Pencil size={15} /></button>
                <button type="button" className="adm-icon-button adm-icon-danger" disabled={busy} onClick={() => setConfirm({ kind: 'question', question })} aria-label="Delete question" title="Delete"><Trash2 size={15} /></button>
              </div>
            </li>)}</ol>}
        </div>
      </div>}

    <Drawer open={Boolean(drawer)} title={drawer && questions.some((item) => item.id === drawer.question.id) ? 'Edit question' : 'Add question'} subtitle={`${bank.title} · ${course.title}`} locked={drawerBusy} onClose={() => setDrawer(null)}>
      {drawer && <QuestionForm key={drawer.question.id} bankId={bank.bank} question={drawer.question} onSave={saveQuestion} onCancel={() => setDrawer(null)} onBusyChange={setDrawerBusy} />}
    </Drawer>
    <Drawer open={Boolean(importer)} title="Import questions from CSV" subtitle={`${bank.title} · ${course.title}`} locked={busy} onClose={() => setImporter(null)}>
      {importer && <CsvImport importer={importer} setImporter={setImporter} busy={busy} existing={questions.length} onImport={(imported) => run(async () => { await commit(importer.mode === 'replace' ? imported : [...questions, ...imported], `${imported.length} question${imported.length === 1 ? '' : 's'} imported.`); setImporter(null) })} />}
    </Drawer>
    <ConfirmDialog open={Boolean(confirm)} busy={busy} onCancel={() => setConfirm(null)} onConfirm={remove}
      title={confirm?.kind === 'reset' ? 'Reset this bank to the built-in questions?' : 'Delete this question?'}
      confirmLabel={confirm?.kind === 'reset' ? 'Reset bank' : 'Delete'}
      message={confirm?.kind === 'reset' ? `All ${questions.length} questions managed here for “${bank.title}” will be removed and students will see the built-in questions again.` : confirm ? `“${confirm.question.prompt.slice(0, 120)}” will be removed from every course that uses this bank.` : ''} />
  </section>
}

function CsvImport({ importer, setImporter, busy, existing, onImport }) {
  const parsed = useMemo(() => importer.text.trim() ? questionsFromCsv(importer.text) : null, [importer.text])
  const readFile = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) setImporter({ ...importer, text: await file.text() }) }
  return <div className="adm-form">
    <div className="adm-form-body">
      <section className="adm-form-section">
        <h3>1 · Prepare the file</h3>
        <p className="adm-hint">One question per row with the columns <code>question, option_a, option_b, option_c, option_d, correct, explanation, difficulty</code>. Use a letter for <code>correct</code> and 1–3 for <code>difficulty</code>. Add <code>option_e</code> or <code>option_f</code> for more options.</p>
        <button type="button" className="adm-button adm-button-ghost adm-button-small" onClick={() => download('questions-template.csv', CSV_TEMPLATE)}><Download size={15} /> Download template</button>
      </section>
      <section className="adm-form-section">
        <h3>2 · Choose or paste it</h3>
        <label className="adm-dropzone adm-dropzone-compact"><FileUp size={20} /><b>Choose a CSV file</b><small>Exported from Excel or Google Sheets</small><input type="file" accept=".csv,text/csv" onChange={readFile} className="sr-only" /></label>
        <label className="adm-field">…or paste the CSV<textarea rows={6} value={importer.text} onChange={(event) => setImporter({ ...importer, text: event.target.value })} spellCheck={false} /></label>
      </section>
      <section className="adm-form-section">
        <h3>3 · Import</h3>
        <div className="adm-segmented" role="radiogroup" aria-label="Import mode">
          <button type="button" role="radio" aria-checked={importer.mode === 'append'} className={importer.mode === 'append' ? 'active' : ''} onClick={() => setImporter({ ...importer, mode: 'append' })}><b>Add to bank</b><small>Keep the {existing} existing</small></button>
          <button type="button" role="radio" aria-checked={importer.mode === 'replace'} className={importer.mode === 'replace' ? 'active' : ''} onClick={() => setImporter({ ...importer, mode: 'replace' })}><b>Replace bank</b><small>Remove the {existing} existing</small></button>
        </div>
        {parsed && <div className={parsed.errors.length ? 'adm-import-summary warn' : 'adm-import-summary'}>
          <b>{parsed.questions.length} question{parsed.questions.length === 1 ? '' : 's'} ready to import</b>
          {parsed.errors.length > 0 && <><span>{parsed.errors.length} row{parsed.errors.length === 1 ? '' : 's'} will be skipped:</span><ul>{parsed.errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul>{parsed.errors.length > 8 && <span>…and {parsed.errors.length - 8} more.</span>}</>}
        </div>}
      </section>
    </div>
    <footer className="adm-form-footer">
      <button type="button" className="adm-button adm-button-ghost" onClick={() => setImporter(null)} disabled={busy}>Cancel</button>
      <button type="button" className="adm-button adm-button-primary" disabled={busy || !parsed?.questions.length} onClick={() => onImport(parsed.questions)}>{busy ? 'Importing…' : `Import ${parsed?.questions.length || ''} questions`}</button>
    </footer>
  </div>
}
