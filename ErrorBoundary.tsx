import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Application error:', error, errorInfo)
    }

    handleReload = () => {
        window.location.reload()
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                        <p className="text-gray-400 mb-6">
                            An unexpected error occurred. Please try refreshing the page.
                        </p>
                        {this.state.error && (
                            <pre className="bg-black/50 rounded-lg p-3 text-left text-xs text-red-400 overflow-auto mb-6 max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-medium hover:bg-white/10 transition-all"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reload
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
