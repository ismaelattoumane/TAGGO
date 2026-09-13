import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './styles/tokens.css'
import './components/Alert.css'
import './components/ui/Button/Button.css'
import './components/ui/Field/Field.css'
import './components/ui/Card/Card.css'
import './components/ui/Badge/Badge.css'
import './components/ui/Layout/Layout.css'
import './components/ui/State/State.css'
import './components/ui/Typography/Typography.css'
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
