import React from 'react'

/**
 * Renders either a user-uploaded cover image or an atmospheric SVG/CSS artwork backdrop.
 */
export function AreaArtwork({
  style = 'koi',
  coverUrl = null,
  posX = 50,
  posY = 50,
  zoom = 100,
  className = '',
}) {
  if (coverUrl) {
    return (
      <div className={`relative overflow-hidden bg-[#080c0d] ${className}`}>
        <img
          src={coverUrl}
          alt=""
          decoding="async"
          fetchPriority="high"
          style={{
            objectPosition: `${posX}% ${posY}%`,
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: `${posX}% ${posY}%`,
          }}
          className="h-full w-full object-cover transition-transform duration-200"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15" />
      </div>
    )
  }

  if (style === 'koi') {
    return (
      <div className={`relative overflow-hidden bg-[#06181c] ${className}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.22),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(6,182,212,0.18),transparent_50%)]" />
        <svg viewBox="0 0 800 400" className="h-full w-full object-cover opacity-90" preserveAspectRatio="xMidYMid slice">
          <rect width="800" height="400" fill="#071a20" />
          <g fill="#15803d" opacity="0.85">
            <ellipse cx="140" cy="90" rx="58" ry="26" />
            <ellipse cx="210" cy="115" rx="42" ry="18" fill="#16a34a" />
            <ellipse cx="620" cy="270" rx="68" ry="30" />
            <ellipse cx="540" cy="300" rx="45" ry="20" fill="#22c55e" opacity="0.7" />
            <ellipse cx="690" cy="230" rx="38" ry="16" fill="#166534" />
          </g>
          <circle cx="155" cy="86" r="8" fill="#fef08a" />
          <circle cx="635" cy="264" r="9" fill="#fde047" />
          <g stroke="#22c55e" strokeWidth="4" opacity="0.55">
            <line x1="650" y1="210" x2="660" y2="95" />
            <line x1="670" y1="220" x2="688" y2="110" />
            <line x1="690" y1="215" x2="705" y2="125" />
            <line x1="710" y1="225" x2="720" y2="100" />
          </g>
          <g fill="#38bdf8" opacity="0.8">
            <circle cx="660" cy="95" r="5" />
            <circle cx="688" cy="110" r="4" />
            <circle cx="720" cy="100" r="5" />
          </g>
          <g transform="translate(270, 210) rotate(-18)">
            <ellipse cx="0" cy="0" rx="48" ry="16" fill="#f8fafc" />
            <ellipse cx="-10" cy="-2" rx="18" ry="11" fill="#ef4444" />
            <ellipse cx="18" cy="2" rx="14" ry="9" fill="#dc2626" />
            <polygon points="-46,0 -68,-14 -64,14" fill="#fca5a5" opacity="0.9" />
          </g>
          <g transform="translate(200, 275) rotate(12)">
            <ellipse cx="0" cy="0" rx="38" ry="13" fill="#f59e0b" />
            <ellipse cx="8" cy="-1" rx="12" ry="8" fill="#fbbf24" />
            <polygon points="-36,0 -55,-11 -52,11" fill="#fcd34d" opacity="0.85" />
          </g>
          <g transform="translate(360, 295) rotate(-8)">
            <ellipse cx="0" cy="0" rx="44" ry="15" fill="#e2e8f0" />
            <ellipse cx="-6" cy="0" rx="20" ry="10" fill="#ef4444" />
            <polygon points="-42,0 -60,-12 -58,12" fill="#f87171" opacity="0.85" />
          </g>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      </div>
    )
  }

  if (style === 'forest') {
    return (
      <div className={`relative overflow-hidden bg-[#061c22] ${className}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_40%,rgba(45,212,191,0.35),transparent_55%),radial-gradient(circle_at_20%_80%,rgba(6,182,212,0.2),transparent_50%)]" />
        <svg viewBox="0 0 800 400" className="h-full w-full object-cover opacity-90" preserveAspectRatio="xMidYMid slice">
          <rect width="800" height="400" fill="#072229" />
          <circle cx="460" cy="180" r="140" fill="#5eead4" opacity="0.18" />
          <circle cx="460" cy="180" r="85" fill="#99f6e4" opacity="0.22" />
          <g fill="#04151a" opacity="0.88">
            <rect x="60" y="0" width="32" height="320" />
            <rect x="135" y="0" width="22" height="310" />
            <rect x="230" y="0" width="44" height="330" />
            <rect x="570" y="0" width="36" height="325" />
            <rect x="660" y="0" width="24" height="315" />
            <rect x="730" y="0" width="40" height="330" />
          </g>
          <ellipse cx="470" cy="195" rx="95" ry="52" fill="#ccfbf1" opacity="0.55" />
          <rect x="0" y="305" width="800" height="95" fill="#041318" opacity="0.85" />
          <ellipse cx="460" cy="345" rx="150" ry="22" fill="#2dd4bf" opacity="0.16" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      </div>
    )
  }

  if (style === 'studio') {
    return (
      <div className={`relative overflow-hidden bg-[#1a110b] ${className}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(245,158,11,0.32),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(234,88,12,0.2),transparent_50%)]" />
        <svg viewBox="0 0 800 400" className="h-full w-full object-cover opacity-85" preserveAspectRatio="xMidYMid slice">
          <rect width="800" height="400" fill="#18100c" />
          <rect x="120" y="40" width="260" height="220" rx="8" fill="#fb923c" opacity="0.18" />
          <rect x="420" y="40" width="260" height="220" rx="8" fill="#fbbf24" opacity="0.12" />
          <line x1="250" y1="40" x2="250" y2="260" stroke="#0c0806" strokeWidth="8" />
          <line x1="120" y1="150" x2="380" y2="150" stroke="#0c0806" strokeWidth="8" />
          <rect x="0" y="290" width="800" height="110" fill="#0e0907" />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      </div>
    )
  }

  const palettes = {
    meadow: 'from-emerald-950 via-teal-900/50 to-stone-950',
    library: 'from-amber-950 via-orange-950/60 to-stone-950',
    zen: 'from-teal-950 via-emerald-900/50 to-slate-950',
    warm: 'from-rose-950 via-amber-950/50 to-stone-950',
    night: 'from-indigo-950 via-slate-900/70 to-zinc-950',
    cinema: 'from-purple-950 via-indigo-950/60 to-zinc-950',
    craft: 'from-yellow-950 via-amber-950/50 to-stone-950',
  }
  const grad = palettes[style] || palettes.night

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${grad} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(242,184,128,0.18),transparent_55%)]" />
      <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#f2b880]/10 blur-3xl" />
      <div className="absolute -bottom-10 left-10 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
    </div>
  )
}
