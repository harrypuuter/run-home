import { MapPin } from 'lucide-react'

function Button({ children, variant = 'primary', disabled = false, onClick, className = '', ...props }) {
  const baseClasses = 'font-medium py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2'

  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg',
    secondary: 'bg-slate-700/50 backdrop-blur text-slate-200 border border-slate-600/50 hover:bg-slate-700/70',
    ghost: 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200',
  }

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
