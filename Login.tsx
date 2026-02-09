import { useState } from 'react'
import { authenticateUser, User } from './db'
import { Shield, User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react'

interface LoginProps {
    onLogin: (user: User) => void
}

export default function Login({ onLogin }: LoginProps) {
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!name.trim() || !password.trim()) {
            setError('Please enter both name and password')
            return
        }

        setIsLoading(true)

        try {
            const user = await authenticateUser(name.trim(), password)

            if (user) {
                onLogin(user)
            } else {
                setError('Invalid name or password')
            }
        } catch (err) {
            console.error('Login error:', err)
            setError('Login failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="login-screen">
            <div className="login-box">
                <h1>Open Ward</h1>
                <p>Sign in to continue</p>

                <form onSubmit={handleSubmit}>
                    {/* Name Input */}
                    <div className="mb-4 text-left">
                        <label htmlFor="name" className="block text-gray-300 text-sm font-medium mb-2">
                            Name
                        </label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                autoComplete="username"
                                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="mb-6 text-left">
                        <label htmlFor="password" className="block text-gray-300 text-sm font-medium mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                className="w-full pl-12 pr-12 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-msg mb-4" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn btn-primary w-full justify-center"
                    >
                        {isLoading ? (
                            <>
                                <div className="spinner w-5 h-5 border-2 !border-t-white/50 !border-r-transparent !border-b-transparent !border-l-transparent mr-2"></div>
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <p className="mt-8 text-xs text-gray-500">
                    Ward Management System v1.0
                </p>
            </div>
        </div>
    )
}
