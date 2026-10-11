import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
import '@fontsource-variable/inter'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DirectionProvider>
        <App />
      </DirectionProvider>
    </ThemeProvider>
  </StrictMode>
)
