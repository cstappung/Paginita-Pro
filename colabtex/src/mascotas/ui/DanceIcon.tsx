import { useId, type ReactNode } from 'react'

// Ícono propio de cada baile (los bailes no son un objeto que se pueda mostrar en 3D).
// Dibujados con el mismo trazo de tinta que el resto del juego; los legendarios llevan aro dorado.

const INK = '#3a2416'
const ink = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

interface Look {
  /** Fondo: centro y borde del degradado. */
  bg: [string, string]
  legendary?: boolean
  draw: () => ReactNode
}

const ICONS: Record<string, Look> = {
  // Maracas cruzadas.
  salsa: {
    bg: ['#ffe2b8', '#ffb36b'],
    draw: () => (
      <>
        <g transform="rotate(-28 32 34)">
          <rect x="29.5" y="34" width="5" height="20" rx="2.5" fill="#8a5a3a" {...ink} />
          <ellipse cx="32" cy="24" rx="10" ry="13" fill="#e8453c" {...ink} />
          <circle cx="28" cy="20" r="2" fill="#ffd84a" />
          <circle cx="35" cy="26" r="2" fill="#ffd84a" />
          <circle cx="30" cy="30" r="1.6" fill="#ffd84a" />
          <path d="M26 15 q3 -4 7 -3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
        </g>
        <g transform="rotate(28 32 34)">
          <rect x="29.5" y="34" width="5" height="20" rx="2.5" fill="#8a5a3a" {...ink} />
          <ellipse cx="32" cy="24" rx="10" ry="13" fill="#ffc93c" {...ink} />
          <path d="M23 22 h18 M23.5 28 h17" stroke="#e8453c" strokeWidth="3" />
          <ellipse cx="32" cy="24" rx="10" ry="13" fill="none" {...ink} />
        </g>
      </>
    ),
  },
  // Remolino.
  spin: {
    bg: ['#d9f6f2', '#7fd3c7'],
    draw: () => (
      <>
        <path d="M33 33 m0 0 a3 3 0 1 1 -3 -3 a7 7 0 0 1 9 6 a11 11 0 0 1 -12 11 a15 15 0 0 1 -15 -15 a18 18 0 0 1 19 -18" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
        <path d="M33 33 m0 0 a3 3 0 1 1 -3 -3 a7 7 0 0 1 9 6 a11 11 0 0 1 -12 11 a15 15 0 0 1 -15 -15 a18 18 0 0 1 19 -18" fill="none" stroke="#3db5a6" strokeWidth="4" strokeLinecap="round" />
        <path d="M46 16 q5 3 7 9 M50 12 q3 2 4 4" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      </>
    ),
  },
  // Cabeza de robot.
  robot: {
    bg: ['#e6e6ff', '#a9a8f0'],
    draw: () => (
      <>
        <path d="M32 18 V10" {...ink} />
        <circle cx="32" cy="9" r="3.5" fill="#ef4f4f" {...ink} />
        <rect x="10" y="26" width="5" height="12" rx="2" fill="#7f97ad" {...ink} />
        <rect x="49" y="26" width="5" height="12" rx="2" fill="#7f97ad" {...ink} />
        <rect x="14" y="18" width="36" height="32" rx="7" fill="#b7c9da" {...ink} />
        <rect x="19" y="24" width="26" height="13" rx="4" fill="#3a4a5c" stroke={INK} strokeWidth="2" />
        <circle cx="26" cy="30.5" r="3.4" fill="#ffe14d" />
        <circle cx="38" cy="30.5" r="3.4" fill="#ffe14d" />
        <path d="M23 43 h18" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 4.5" />
      </>
    ),
  },
  // Bola de disco con destellos.
  disco: {
    bg: ['#ffd6f3', '#c47be0'],
    draw: () => (
      <>
        <path d="M32 6 V15" {...ink} />
        <circle cx="32" cy="35" r="19" fill="#d6dde8" {...ink} />
        <g stroke="#8e9bb0" strokeWidth="1.4" fill="none">
          <ellipse cx="32" cy="35" rx="9" ry="19" />
          <path d="M13.5 35 h37 M16 25 h32 M16 45 h32 M21 18.5 h22 M21 51.5 h22 M32 16 v38" />
        </g>
        <rect x="21" y="24" width="7" height="7" fill="#fff" opacity=".9" />
        <rect x="36" y="38" width="6" height="6" fill="#9fe7ff" opacity=".9" />
        <rect x="24" y="40" width="5" height="5" fill="#ffb3e6" opacity=".9" />
        <circle cx="32" cy="35" r="19" fill="none" {...ink} />
        <path d="M51 12 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
  },
  // Pollo loco: cabeza de pollo con ojos en espiral.
  conga: {
    bg: ['#e9f9cf', '#9fd56b'],
    draw: () => (
      <>
        <path d="M22 17 q2 -9 7 -4 q3 -8 7 -1 q5 -6 6 3" fill="#e8453c" {...ink} />
        <circle cx="32" cy="34" r="17" fill="#fff4d6" {...ink} />
        <path d="M30 37 l-6 4 6 3z" fill="#ff9a2a" {...ink} transform="translate(-6 0)" />
        <path d="M26 46 q-2 7 3 7 q3 0 1 -6" fill="#e8453c" {...ink} />
        <g fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round">
          <path d="M28 30 a1.2 1.2 0 1 1 -1.2 -1.2 a2.6 2.6 0 0 1 2.6 2.6 a4 4 0 0 1 -4 4" />
          <path d="M41 30 a1.2 1.2 0 1 1 -1.2 -1.2 a2.6 2.6 0 0 1 2.6 2.6 a4 4 0 0 1 -4 4" />
        </g>
        <path d="M50 22 l4 -3 M52 28 h5 M12 24 l-4 -2" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
  // Pañuelo de cueca al aire.
  cueca: {
    bg: ['#ffe3e3', '#f59a9a'],
    draw: () => (
      <>
        <path d="M14 14 Q28 8 40 16 Q50 22 52 34 Q44 40 46 52 Q32 46 22 50 Q22 36 12 30 Q18 22 14 14z" fill="#ffffff" {...ink} />
        <path d="M17 17 Q28 12 38 19 Q46 24 48 33" fill="none" stroke="#3d6fd6" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 29 Q24 36 25 46" fill="none" stroke="#e8453c" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 26 q4 6 2 12" fill="none" stroke="#c9d3e0" strokeWidth="2" strokeLinecap="round" />
        <circle cx="14" cy="14" r="3" fill="#ffc93c" {...ink} />
      </>
    ),
  },
  // Paso lunar: luna menguante con sombrero.
  moonwalk: {
    bg: ['#5a5fb8', '#232650'],
    legendary: true,
    draw: () => (
      <>
        <path d="M40 14 A20 20 0 1 0 50 46 A16 16 0 1 1 40 14z" fill="#ffe27a" {...ink} />
        <g transform="rotate(-18 40 16)">
          <path d="M30 18 h20" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M30 18 h20" stroke="#2b2b33" strokeWidth="3" strokeLinecap="round" />
          <path d="M34 18 v-7 q6 -3 12 0 v7z" fill="#2b2b33" {...ink} />
          <path d="M34 15 h12" stroke="#e8453c" strokeWidth="2.2" />
        </g>
        <path d="M14 14 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z M50 52 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" fill="#fff" />
      </>
    ),
  },
  // Danza cósmica: planeta con anillo y estrellas.
  cosmic: {
    bg: ['#7a4fd6', '#2a1550'],
    legendary: true,
    draw: () => (
      <>
        <path d="M10 38 Q32 26 54 26" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M10 38 Q32 26 54 26" fill="none" stroke="#ffcf3a" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="32" cy="33" r="14" fill="#ff7ac8" {...ink} />
        <path d="M21 29 q11 -4 22 0 M20 36 q12 4 24 -1" fill="none" stroke="#c94fa0" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18 44 Q38 40 50 30" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M18 44 Q38 40 50 30" fill="none" stroke="#ffcf3a" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M14 13 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z M50 10 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z M48 50 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z" fill="#fff" />
      </>
    ),
  },
}

/** Ícono redondo de un baile. */
export function DanceIcon({ id, size = 48 }: { id: string; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const look = ICONS[id]
  if (!look) return null
  return (
    <svg className="dance-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={`bg${uid}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={look.bg[0]} />
          <stop offset="1" stopColor={look.bg[1]} />
        </radialGradient>
        {look.legendary && (
          <linearGradient id={`rim${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3b0" />
            <stop offset=".5" stopColor="#f2b51e" />
            <stop offset="1" stopColor="#fff0a0" />
          </linearGradient>
        )}
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#bg${uid})`} />
      {look.draw()}
      <circle cx="32" cy="32" r="30" fill="none" stroke={look.legendary ? `url(#rim${uid})` : INK} strokeWidth={look.legendary ? 3.5 : 2.2} />
    </svg>
  )
}
