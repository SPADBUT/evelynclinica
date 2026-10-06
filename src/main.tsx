import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

async function renderApp() {
  if (import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true') {
    const { SupabaseAuthProvider } = await import('./context/SupabaseAuthContext.tsx')
    root.render(
      <StrictMode>
        <SupabaseAuthProvider>
          <App />
        </SupabaseAuthProvider>
      </StrictMode>,
    )
    return
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void renderApp()
