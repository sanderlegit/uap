import { useDocVocabScores } from '../hooks/useData'

const COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444']
const LABELS = ['Neutral', 'Mild', 'Loaded', 'Shibboleth']

function scoreToLevel(score) {
  if (score >= 80) return 4
  if (score >= 30) return 3
  if (score >= 10) return 2
  if (score > 0) return 1
  return 0
}

export default function VocabBadge({ docId }) {
  const scores = useDocVocabScores()
  if (!scores) return null
  const info = scores[String(docId)]
  if (!info || info.score === 0) return null

  const level = scoreToLevel(info.score)
  const color = COLORS[level - 1]

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${color}15`, color }}
      title={`Vocabulary loading score: ${info.score} (${info.loaded_term_count} loaded terms). ${LABELS[level - 1]} language density.`}
    >
      <span className="flex gap-px">
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-sm"
            style={{ backgroundColor: i <= level ? color : 'rgba(100,116,139,0.2)' }}
          />
        ))}
      </span>
      {info.loaded_term_count}
    </span>
  )
}
