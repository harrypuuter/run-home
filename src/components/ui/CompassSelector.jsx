function CompassSelector({ selected, onSelect }) {
  const directions = [
    { id: 'north', label: 'N', position: 'top-0 left-1/2 -translate-x-1/2' },
    { id: 'east', label: 'E', position: 'top-1/2 right-0 -translate-y-1/2' },
    { id: 'south', label: 'S', position: 'bottom-0 left-1/2 -translate-x-1/2' },
    { id: 'west', label: 'W', position: 'top-1/2 left-0 -translate-y-1/2' },
  ]

  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 mx-auto">
      {/* Center "Any" button */}
      <button
        onClick={() => onSelect('any')}
        className={`
          absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-16 h-16 md:w-20 md:h-20 rounded-full
          flex items-center justify-center
          font-semibold text-sm md:text-base
          transition-all duration-200
          ${selected === 'any'
            ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
            : 'bg-slate-700/50 backdrop-blur border border-slate-600/50 text-slate-300 hover:bg-slate-700/70'
          }
        `}
      >
        Any
      </button>

      {/* Direction buttons */}
      {directions.map(({ id, label, position }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`
            absolute ${position}
            w-14 h-14 md:w-16 md:h-16 rounded-xl
            flex items-center justify-center
            font-bold text-lg md:text-xl
            transition-all duration-200
            ${selected === id
              ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
              : 'bg-slate-700/50 backdrop-blur border border-slate-600/50 text-slate-300 hover:bg-slate-700/70'
            }
          `}
        >
          {label}
        </button>
      ))}

      {/* Connecting lines (decorative) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 md:w-40 md:h-40 border-2 border-dashed border-slate-600 rounded-full" />
      </div>
    </div>
  )
}

export default CompassSelector
