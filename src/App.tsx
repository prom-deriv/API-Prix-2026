import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import MochiMoto from './pages/MochiMoto'
import SurfTheWaves from './pages/SurfTheWaves'
import { ThemeProvider } from './contexts/ThemeContext'
import { AccountProvider } from './contexts/AccountContext'

function App() {
  return (
    <ThemeProvider>
      <AccountProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mochi-moto" element={<MochiMoto />} />
          <Route path="/surf-the-waves" element={<SurfTheWaves />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AccountProvider>
    </ThemeProvider>
  )
}

export default App
