import { Check } from 'lucide-react'

function Checkbox({ checked, onChange, label, icon, disabled = false }) {
  return (
    <label
      className={`
        flex items-center gap-3 p-4 rounded-xl cursor-pointer
        transition-all duration-200
        ${checked
          ? 'bg-blue-500/20 border-blue-500/50'
          : 'bg-slate-700/50 border-slate-600/50 hover:bg-slate-700/70'
        }
        border backdrop-blur
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div
        className={`
          w-5 h-5 rounded flex items-center justify-center
          transition-all duration-200
          ${checked
            ? 'bg-blue-500 text-white'
            : 'bg-slate-600 border border-slate-500'
          }
        `}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </div>

      {icon && <span className="text-xl">{icon}</span>}

      <span className="font-medium text-slate-200">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
    </label>
  )
}

export default Checkbox
