function RadioCard({ selected, onClick, icon, label, color = 'blue', disabled = false }) {
  const colorClasses = {
    blue: {
      selected: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/25',
      hover: 'hover:shadow-blue-500/30',
    },
    green: {
      selected: 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-emerald-500/25',
      hover: 'hover:shadow-emerald-500/30',
    },
    orange: {
      selected: 'bg-gradient-to-br from-orange-400 to-amber-500 shadow-orange-500/25',
      hover: 'hover:shadow-orange-500/30',
    },
  }

  const colors = colorClasses[color] || colorClasses.blue

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-6 md:p-8 rounded-2xl flex flex-col items-center gap-3
        transition-all duration-200
        ${selected
          ? `${colors.selected} text-white shadow-lg hover:shadow-xl ${colors.hover} hover:scale-[1.02]`
          : 'bg-slate-700/50 backdrop-blur border border-slate-600/50 text-slate-300 hover:bg-slate-700/70'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        active:scale-100
      `}
    >
      <span className="text-5xl md:text-6xl">{icon}</span>
      <span className="font-semibold text-lg md:text-xl">{label}</span>
    </button>
  )
}

export default RadioCard
