import { useState } from 'react'
import { Button, Badge, Progress } from '@client/components/ui'
import { useRevisions, useRevisionsDue, useGradeRevision } from '@client/hooks/useRevisions'
import { cn } from '@client/lib/utils'

const GRADES = ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const
const GRADE_KEYS: Record<string, typeof GRADES[number]> = { '1': 'AGAIN', '2': 'HARD', '3': 'GOOD', '4': 'EASY' }
const GRADE_COLORS: Record<string, string> = { AGAIN: 'text-red-400', HARD: 'text-orange-400', GOOD: 'text-green-400', EASY: 'text-blue-400' }

export default function Revise() {
  const { data: allRevisions = [] } = useRevisions()
  const { data: dueItems = [] } = useRevisionsDue()
  const gradeRevision = useGradeRevision()

  const [sessionActive, setSessionActive] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const currentCard = dueItems[currentIndex]
  const totalDue = dueItems.length
  const totalRevisions = allRevisions.reduce((sum: number, r: any) => sum + r.totalRevisions, 0)

  const startSession = () => {
    setSessionActive(true)
    setCurrentIndex(0)
    setRevealed(false)
  }

  const handleGrade = (grade: typeof GRADES[number]) => {
    if (!currentCard) return
    gradeRevision.mutate({ id: currentCard.id, grade })
    advance()
  }

  const advance = () => {
    setRevealed(false)
    if (currentIndex + 1 < totalDue) {
      setCurrentIndex(i => i + 1)
    } else {
      setSessionActive(false)
    }
  }

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!sessionActive) return
    if (!revealed && e.key === ' ') {
      e.preventDefault()
      setRevealed(true)
    } else if (revealed && GRADE_KEYS[e.key]) {
      handleGrade(GRADE_KEYS[e.key])
    } else if (e.key === 's') {
      advance() // skip
    }
  }

  // Overview
  if (!sessionActive) {
    return (
      <div className="h-full overflow-y-auto" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Due today', value: totalDue, accent: totalDue > 0 },
              { label: 'Total cards', value: allRevisions.length },
              { label: 'Lifetime reviews', value: totalRevisions },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl p-4 ring-1 ring-border"
                style={{ background: s.accent ? 'var(--grad-selected)' : 'var(--surface-2)' }}
              >
                <p className={cn('text-[11.5px]', s.accent ? 'text-white/80' : 'text-muted-foreground')}>{s.label}</p>
                <p className={cn('mt-2 text-[26px] font-semibold leading-none tabular-nums', s.accent && 'text-white')}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
            <h3 className="mb-3 text-[14px] font-semibold">Mastery breakdown</h3>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map(stage => {
                const count = allRevisions.filter((r: any) => r.currentStepIndex === stage).length
                const pct = allRevisions.length > 0 ? (count / allRevisions.length) * 100 : 0
                return (
                  <div key={stage} className="flex items-center gap-3 text-[11.5px]">
                    <span className="w-14 text-muted-foreground">Stage {stage}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
                    </div>
                    <span className="w-5 text-right tabular-nums text-muted-foreground">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {totalDue > 0 ? (
            <button
              onClick={startSession}
              className="w-full rounded-xl py-3 text-[13px] font-semibold text-white transition hover:opacity-90"
              style={{ background: 'var(--grad-selected)' }}
            >
              Start session · {totalDue} cards
            </button>
          ) : (
            <div className="rounded-xl bg-surface-2 py-10 text-center ring-1 ring-border">
              <p className="text-[13px] font-medium">All caught up</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">No cards due for review today.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Session view
  return (
    <div className="flex h-full flex-col items-center justify-center" tabIndex={0} onKeyDown={handleKeyDown} autoFocus>
      {/* Progress */}
      <div className="mb-6 w-full max-w-lg">
        <div className="mb-1.5 flex justify-between text-[11.5px] text-muted-foreground">
          <span className="tabular-nums">Card {currentIndex + 1} of {totalDue}</span>
          <span className="tabular-nums">{Math.round((currentIndex / totalDue) * 100)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(currentIndex / totalDue) * 100}%`, background: 'var(--primary)' }}
          />
        </div>
      </div>

      {/* Card */}
      {currentCard && (
        <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-border">
          <div className="h-[3px] w-full" style={{ background: 'var(--grad-selected)' }} />
          <div className="space-y-4 p-7 text-center">
            <span className="inline-block rounded-full bg-surface-3 px-2.5 py-1 text-[10.5px] text-muted-foreground">
              Stage {currentCard.currentStepIndex}/6 · {Math.round((currentCard.currentStepIndex / 6) * 100)}% mastered
            </span>

            <h3 className="text-[19px] font-semibold leading-snug">{currentCard.title}</h3>

            {revealed ? (
              <div className="space-y-3 text-left">
                {currentCard.concept && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{currentCard.concept}</p>
                )}
                {currentCard.codeSnippet && (
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-3 p-3 text-[11.5px] leading-relaxed">
                    {currentCard.codeSnippet}
                  </pre>
                )}
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="rounded-lg bg-surface-3 px-5 py-2.5 text-[12.5px] font-medium transition hover:bg-accent"
              >
                Reveal · Space
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grades */}
      {revealed && (
        <div className="mt-5 flex gap-2">
          {GRADES.map((grade, i) => (
            <button
              key={grade}
              onClick={() => handleGrade(grade)}
              className={cn(
                'min-w-[86px] rounded-lg bg-surface-2 px-3 py-2.5 text-[12px] font-medium ring-1 ring-border transition hover:bg-surface-3',
                GRADE_COLORS[grade]
              )}
            >
              {grade.charAt(0) + grade.slice(1).toLowerCase()}
              <span className="ml-1.5 opacity-45">{i + 1}</span>
            </button>
          ))}
          <button
            onClick={advance}
            className="rounded-lg px-3 py-2.5 text-[12px] text-muted-foreground transition hover:text-foreground"
          >
            Skip · s
          </button>
        </div>
      )}
    </div>
  )
}
