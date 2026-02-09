import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db, User } from './db'
import ErrorBoundary from './ErrorBoundary'
import Login from './Login'
import Dashboard from './Dashboard'
import PatientDetail from './PatientDetail'

function App() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initializeApp = async () => {
            try {
                const savedUserId = localStorage.getItem('ward_user_id')
                if (savedUserId) {
                    const savedUser = await db.users.get(Number(savedUserId))
                    if (savedUser) {
                        setUser(savedUser)
                    } else {
                        // User not found, clear invalid session
                        localStorage.removeItem('ward_user_id')
                    }
                }
            } catch (error) {
                console.error('Failed to restore session:', error)
                localStorage.removeItem('ward_user_id')
            } finally {
                setLoading(false)
            }
        }

        initializeApp()
    }, [])

    const handleLogin = (loggedInUser: User) => {
        setUser(loggedInUser)
        localStorage.setItem('ward_user_id', String(loggedInUser.id))
    }

    const handleLogout = () => {
        setUser(null)
        localStorage.removeItem('ward_user_id')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/login"
                        element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
                    />
                    <Route
                        path="/"
                        element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
                    />
                    <Route
                        path="/patient/:id"
                        element={user ? <PatientDetail user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/" replace />}
                    />
                </Routes>
            </BrowserRouter>
        </ErrorBoundary>
    )
}

export default App
