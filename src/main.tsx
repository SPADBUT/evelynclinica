import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

async function renderApp() {
  if (import.meta.env.VITE_SUPABASE_AUTH_ENABLED === 'true') {
    const [{ SupabaseAuthProvider }, { V3TenantProvider }] = await Promise.all([
      import('./context/SupabaseAuthContext.tsx'),
      import('./context/V3TenantContext.tsx'),
    ])
    root.render(
      <StrictMode>
        <SupabaseAuthProvider>
          <V3TenantProvider>
            <App />
          </V3TenantProvider>
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
