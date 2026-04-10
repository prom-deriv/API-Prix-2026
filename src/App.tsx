import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import MochiMoto from './pages/MochiMoto'
import SurfTheWaves from './pages/SurfTheWaves'
import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mochi-moto" element={<MochiMoto />} />
        <Route path="/surf-the-waves" element={<SurfTheWaves />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App
