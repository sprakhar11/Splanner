import { motion } from 'motion/react'
import type { Stage, Health } from '@client/lib/habits'
import { cn } from '@client/lib/utils'

/**
 * The plant itself. Stage picks the silhouette, health picks the treatment.
 *
 * Those two axes are independent on purpose (spec decision D-1): a neglected
 * plant is a large sick plant, never a seed. So the shape here only ever grows,
 * and health is applied on top as colour, droop and opacity.
 *
 * Colour never carries the state alone — the card prints the health in words
 * beside this — so the visuals can lean on desaturation freely.
 */

export const PLANT_TYPES = ['OAK', 'SUNFLOWER', 'CACTUS', 'BONSAI', 'FERN', 'LAVENDER'] as const
export type PlantType = typeof PLANT_TYPES[number]

export const PLANT_LABELS: Record<PlantType, string> = {
  OAK: 'Oak',
  SUNFLOWER: 'Sunflower',
  CACTUS: 'Cactus',
  BONSAI: 'Bonsai',
  FERN: 'Fern',
  LAVENDER: 'Lavender',
}

/** Default foliage per type, overridable by the habit's colour. */
const TYPE_COLOR: Record<PlantType, string> = {
  OAK: 'var(--ev-green)',
  SUNFLOWER: 'var(--ev-yellow)',
  CACTUS: 'var(--ev-teal)',
  BONSAI: 'var(--ev-green)',
  FERN: 'var(--ev-green)',
  LAVENDER: 'var(--ev-purple)',
}

const HEALTH_TREATMENT: Record<Health, string> = {
  THRIVING: '',
  WILTED: 'grayscale-[0.65] opacity-75',
  DYING: 'grayscale-[0.9] opacity-60',
  // Not lower than this: stacked on the seed's small scale, a dimmer dead plant
  // read as an empty card rather than a neglected one.
  DEAD: 'grayscale opacity-50',
}

/** Degrees of lean. A sick plant sags; a dead one has given up entirely. */
const HEALTH_DROOP: Record<Health, number> = {
  THRIVING: 0,
  WILTED: 4,
  DYING: 9,
  DEAD: 14,
}

const STAGE_SCALE: Record<Stage, number> = {
  SEED: 0.7,
  SPROUT: 0.78,
  SAPLING: 0.87,
  MATURE: 0.94,
  BLOOMING: 1,
}

export default function Plant({
  plantType,
  stage,
  health,
  color,
  className,
  animate = true,
}: {
  plantType: string
  stage: Stage
  health: Health
  color?: string | null
  className?: string
  animate?: boolean
}) {
  const type = (PLANT_TYPES as readonly string[]).includes(plantType)
    ? (plantType as PlantType)
    : 'OAK'

  const foliage = color ? `var(--${color})` : TYPE_COLOR[type]
  const soil = 'var(--surface-3)'
  const stem = health === 'DEAD' ? 'var(--muted-foreground)' : 'var(--ev-green)'

  return (
    <div
      className={cn(
        'relative transition-[filter,opacity] duration-500',
        HEALTH_TREATMENT[health],
        className
      )}
      aria-hidden="true"
    >
      {/*
        Cropped to the drawing rather than the full 64-square: the plant only ever
        occupies x 11–53 and y 4–60, and framing the whole square left it looking
        small and lost in the card.
        `absolute inset-0` is load-bearing. A non-square viewBox gives the SVG an
        intrinsic aspect ratio, and the parent's centring stops it stretching, so
        `h-full w-full` alone let it derive a 124px height inside a 96px box and
        spill over the habit title.
      */}
      <motion.svg
        viewBox="8 -2 48 62"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full overflow-visible"
        initial={false}
        animate={{ rotate: HEALTH_DROOP[health] }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        // Proportional, so the plant always pivots at its base whatever the box size.
        style={{ transformOrigin: '50% 92%' }}
      >
        {/* Soil line, always present so an empty pot still reads as a pot. */}
        <ellipse cx="32" cy="56" rx="15" ry="3.5" fill={soil} />

        <motion.g
          initial={false}
          animate={{ scale: STAGE_SCALE[stage] }}
          transition={
            animate
              ? { type: 'spring', stiffness: 400, damping: 26 }
              : { duration: 0 }
          }
          style={{ transformOrigin: '32px 56px' }}
        >
          {stage === 'SEED' && <Seed foliage={foliage} />}
          {stage !== 'SEED' && (
            <Foliage type={type} stage={stage} foliage={foliage} stem={stem} health={health} />
          )}
        </motion.g>
      </motion.svg>
    </div>
  )
}

function Seed({ foliage }: { foliage: string }) {
  return (
    <g>
      {/* Just broken ground. Humble on purpose — this is day one — but with two
          leaves rather than a dot, so an empty-looking card is never mistaken for
          a rendering failure. */}
      <path d="M32 56 L32 44" stroke={foliage} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="26" cy="43" rx="5.5" ry="3.5" fill={foliage} transform="rotate(-20 26 43)" />
      <ellipse cx="38" cy="43" rx="5.5" ry="3.5" fill={foliage} transform="rotate(20 38 43)" />
    </g>
  )
}

function Foliage({
  type, stage, foliage, stem, health,
}: {
  type: PlantType
  stage: Stage
  foliage: string
  stem: string
  health: Health
}) {
  // Stem lengthens with each stage; the crown grows with it.
  const stemTop = { SPROUT: 40, SAPLING: 32, MATURE: 24, BLOOMING: 18 }[
    stage as 'SPROUT' | 'SAPLING' | 'MATURE' | 'BLOOMING'
  ]
  const crown = 56 - stemTop

  return (
    <g>
      <path
        d={`M32 56 L32 ${stemTop}`}
        stroke={stem}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {type === 'SUNFLOWER' && (
        <>
          {stage !== 'SPROUT' && [0, 60, 120, 180, 240, 300].map(a => (
            <ellipse
              key={a}
              cx="32" cy={stemTop - 5} rx="3.5" ry="6.5"
              fill={foliage}
              transform={`rotate(${a} 32 ${stemTop - 5})`}
            />
          ))}
          <circle cx="32" cy={stemTop - 5} r={stage === 'SPROUT' ? 3.5 : 4} fill="var(--ev-orange)" />
        </>
      )}

      {type === 'CACTUS' && (
        <>
          <rect
            x="27" y={stemTop - 2} width="10" height={crown + 2}
            rx="5" fill={foliage}
          />
          {stage !== 'SPROUT' && (
            <>
              <rect x="18" y={stemTop + 8} width="7" height="14" rx="3.5" fill={foliage} />
              <rect x="39" y={stemTop + 12} width="7" height="11" rx="3.5" fill={foliage} />
            </>
          )}
          {stage === 'BLOOMING' && <circle cx="32" cy={stemTop - 4} r="3" fill="var(--ev-pink)" />}
        </>
      )}

      {type === 'BONSAI' && (
        <>
          <path
            d={`M32 ${stemTop + 8} Q 22 ${stemTop + 4} 20 ${stemTop - 2}`}
            stroke={stem} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          <ellipse cx="20" cy={stemTop - 4} rx="8" ry="5" fill={foliage} />
          <ellipse cx="38" cy={stemTop - 2} rx="9" ry="6" fill={foliage} />
          {stage === 'BLOOMING' && <ellipse cx="30" cy={stemTop - 10} rx="7" ry="4.5" fill={foliage} />}
        </>
      )}

      {type === 'FERN' && (
        <>
          {Array.from({ length: stage === 'SPROUT' ? 2 : stage === 'SAPLING' ? 3 : 4 }, (_, i) => {
            const y = stemTop + i * (crown / 5) + 2
            return (
              <g key={i}>
                <path d={`M32 ${y} Q 22 ${y - 3} 17 ${y - 6}`} stroke={foliage} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d={`M32 ${y} Q 42 ${y - 3} 47 ${y - 6}`} stroke={foliage} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            )
          })}
        </>
      )}

      {type === 'LAVENDER' && (
        <>
          {[-6, 0, 6].slice(0, stage === 'SPROUT' ? 1 : 3).map((dx, i) => (
            <g key={i}>
              <path
                d={`M32 ${stemTop + 6} L ${32 + dx} ${stemTop - 4}`}
                stroke={stem} strokeWidth="1.8" strokeLinecap="round"
              />
              <ellipse cx={32 + dx} cy={stemTop - 7} rx="2.6" ry="6" fill={foliage} />
            </g>
          ))}
        </>
      )}

      {type === 'OAK' && (
        <>
          {/* crown/3, not crown/2.4: at BLOOMING the larger radius put the top of
              the canopy above the viewBox, so the crown was visibly clipped. */}
          <circle cx="32" cy={stemTop - 1} r={crown / 3} fill={foliage} />
          {stage !== 'SPROUT' && (
            <>
              <circle cx={32 - crown / 3.6} cy={stemTop + 4} r={crown / 4.2} fill={foliage} />
              <circle cx={32 + crown / 3.6} cy={stemTop + 4} r={crown / 4.2} fill={foliage} />
            </>
          )}
          {stage === 'BLOOMING' && health === 'THRIVING' && (
            <>
              <circle cx="20" cy={stemTop + 10} r="1.8" fill="var(--ev-pink)" />
              <circle cx="44" cy={stemTop + 6} r="1.8" fill="var(--ev-pink)" />
            </>
          )}
        </>
      )}
    </g>
  )
}
