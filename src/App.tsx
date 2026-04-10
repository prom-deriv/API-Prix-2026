import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import MochiMoto from './pages/MochiMoto'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/mochi-moto" element={<MochiMoto />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
