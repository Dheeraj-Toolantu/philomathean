import { BookOpen, ClipboardCheck, ClipboardList, Crown, LayoutDashboard, LineChart, UserRound } from 'lucide-react'

export const DASHBOARD_TABS = [
  ['overview', 'Overview', LayoutDashboard],
  ['courses', 'My courses', BookOpen],
  ['progress', 'Progress', LineChart],
  ['report', 'Progress card', ClipboardCheck],
  ['exams', 'Exams & attempts', ClipboardList],
  ['profile', 'Profile', UserRound],
  ['subscription', 'Subscription', Crown],
]
export const dashboardUrl = (tab) => tab === 'overview' ? '/dashboard' : `/dashboard?tab=${tab}`
