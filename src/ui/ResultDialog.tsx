import { useEffect, useRef } from 'react'

interface ResultDialogProps {
  message: string
  detail?: string
  onClose: () => void
  onPlayAgain?: () => void
}

export function ResultDialog({ message, detail, onClose, onPlayAgain }: ResultDialogProps) {
  const primary = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    primary.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <header className="dialog-head">
          <h2 id="result-title">Result</h2>
          <button type="button" className="dialog-x" aria-label="Close dialog" onClick={onClose}>
            &times;
          </button>
        </header>
        <p className="result-message">{message}</p>
        {detail && <p className="result-detail">{detail}</p>}
        <div className="dialog-actions">
          {onPlayAgain && (
            <button ref={primary} type="button" className="primary" onClick={onPlayAgain}>
              Play again
            </button>
          )}
          <button ref={onPlayAgain ? undefined : primary} type="button" className={onPlayAgain ? '' : 'primary'} onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}
