import { useEffect, useState } from 'react'
import { getAdminResults, removeResult } from '../../firebase/content'
import ResultForm from './ResultForm'

export default function ResultsManager({ user }) {
  const [items, setItems] = useState([]); const [editing, setEditing] = useState(null); const [error, setError] = useState('')
  const load = async () => { try { setItems(await getAdminResults()); setError('') } catch { setError('Unable to load results. Check your Firebase connection.') } }
  useEffect(() => { let active = true; getAdminResults().then((data) => { if (active) setItems(data) }).catch(() => { if (active) setError('Unable to load results. Check your Firebase connection.') }); return () => { active = false } }, [])
  const remove = async (item) => { if (!window.confirm(`Delete the result for ${item.studentName}?`)) return; try { await removeResult(item.id); load() } catch { setError('The result could not be deleted.') } }
  return <section className="admin-manager"><div className="admin-manager-heading"><div><span className="admin-kicker">Public Results</span><h2>Student results</h2></div><span>{items.length} records</span></div>{error && <p className="admin-error">{error}</p>}<ResultForm key={editing?.id || 'new'} user={user} editing={editing} onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} /><div className="admin-records">{items.length ? items.map((item) => <article key={item.id}><div><strong>{item.studentName}</strong><span>{item.score} · {item.school}</span><small>{item.subjects}</small></div><div className="admin-record-actions"><button type="button" onClick={() => setEditing(item)}>Edit</button><button type="button" onClick={() => remove(item)}>Delete</button></div></article>) : <p className="admin-empty">No results have been added yet.</p>}</div></section>
}
