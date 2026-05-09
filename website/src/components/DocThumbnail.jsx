import { useState } from 'react'
import { thumbUrl, coverUrl } from '../hooks/useData'

function FallbackIcon() {
  return (
    <div className="w-full h-full bg-red-500/10 border border-red-500/20 rounded flex items-center justify-center">
      <span className="text-red-400 text-xs font-bold">PDF</span>
    </div>
  )
}

export default function DocThumbnail({ docId, size = 'sm', className = '' }) {
  const [failed, setFailed] = useState(false)

  if (failed) return <div className={className}><FallbackIcon /></div>

  const src = size === 'lg' ? coverUrl(docId) : thumbUrl(docId)
  const dims = size === 'lg'
    ? 'w-full max-w-sm'
    : size === 'md'
    ? 'w-20 h-[104px]'
    : 'w-12 h-[62px]'

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${dims} object-cover rounded bg-slate-800 flex-shrink-0 ${className}`}
    />
  )
}
