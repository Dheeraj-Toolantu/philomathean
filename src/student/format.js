export const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const formatMinutes = (minutes) => minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
const KIND_LABELS = { topic: 'Topic quiz', ladder: 'Revision ladder', mock: 'Mock exam', prediction: 'Prediction exam', custom: 'Custom exam' }
export const kindLabel = (kind) => KIND_LABELS[kind] || 'Quiz'
