import AppShell from './components/layout/AppShell'
import { TimetableProvider } from './context/TimetableContext'
import './styles/index.css'

function App() {
  return (
    <TimetableProvider>
      <AppShell />
    </TimetableProvider>
  )
}

export default App
