import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <>
        <div style={{ padding: '0.6rem 1rem', background: '#2b2d42', color: '#fff', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          TAGGO
        </div>
        <Outlet />
      </>
    </AuthProvider>
  )
}

export default App
