import { LogOut, Presentation } from 'lucide-react'
import { signOutStudent } from '../firebase/student'
import { BrandLockup } from '../components/site/SiteChrome'
import { isStaffRole } from '../portal/roles'
import { useSession } from './session'
import './student.css'

// Student pages (dashboard, courses, quizzes) are for student accounts and visitors only. Teacher and administrator
// accounts see this notice instead, with a way back to their own portal.
export default function StudentOnly({ children }) {
  const { status, role, user } = useSession()
  if (status === 'loading') return <main className="st-page"><div className="st-dash-loading" aria-busy="true"><span className="st-spinner" /> Loading…</div></main>
  if (!user || !isStaffRole(role)) return children
  const signOut = async () => { await signOutStudent(); window.location.reload() }
  return <main className="st-page st-portal-block">
    <div className="st-portal-block-bar"><BrandLockup /></div>
    <section className="st-empty-page">
      <span className="st-portal-block-icon"><Presentation size={26} /></span>
      <h1>This is a {role === 'admin' ? 'staff' : 'teacher'} account</h1>
      <p>You’re signed in as <b>{user.email}</b>. Student pages are only for student accounts, so they aren’t available here. Use the teacher portal, or sign out to open the student pages with a student account.</p>
      <div className="st-portal-block-actions">
        <a className="st-primary" href={role === 'admin' ? '/admin' : '/teacher'}>{role === 'admin' ? 'Open the admin panel' : 'Open the teacher portal'}</a>
        <button type="button" className="st-secondary" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </div>
    </section>
  </main>
}
