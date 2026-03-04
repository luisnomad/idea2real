import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './views/Dashboard'
import Create from './views/Create'
import PromptStudio from './views/PromptStudio'
import Library from './views/Library'
import History from './views/History'
import PrintPrep from './views/PrintPrep'
import Settings from './views/Settings'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/create" element={<Create />} />
      <Route path="/prompt-studio" element={<PromptStudio />} />
      <Route path="/library" element={<Library />} />
      <Route path="/history" element={<History />} />
      <Route path="/print-prep" element={<PrintPrep />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
