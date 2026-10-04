import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { recordCurrentAppPath } from './lib/navigation'
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
  const location = useLocation()

  useEffect(() => {
    recordCurrentAppPath(location.pathname)
  }, [location.pathname])

  return (
    <AuthProvider>
      <CartProvider>
        <div className="app-bar">
          TAGGO
        </div>
        <Outlet />
      </CartProvider>
    </AuthProvider>
  )
}

export default App
