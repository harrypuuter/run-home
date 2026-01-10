import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error(info)
    this.setState({ info })
  }

  handleReload = () => {
    // Optionally clear elevation cache if it's likely malformed
    try { localStorage.removeItem('elevationCache') } catch (err) { /* ignore */ }
    window.location.reload()
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-xl w-full bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-300 mb-4">An unexpected error occurred. The error has been logged to the console for debugging.</p>
          <details className="text-xs text-slate-300 mb-4 whitespace-pre-wrap" open>
            <summary className="cursor-pointer text-slate-200">Error details</summary>
            <pre className="mt-2 text-xs text-red-300">{error && error.toString()}{info && '\n' + (info.componentStack || '')}</pre>
          </details>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600" onClick={this.handleReload}>Reload</button>
            <button className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(`${error}\n${info?.componentStack || ''}`) }}>Copy</button>
          </div>
        </div>
      </div>
    )
  }
}
