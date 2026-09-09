import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import CoupleApp from './couple/CoupleApp.jsx'
import './couple/couple.css'

const isLanding = window.location.pathname.replace(/\/+$/, '') === '/couple'

createRoot(document.getElementById('couple-root')).render(
  <StrictMode>
    <CoupleApp />
    {isLanding ? <Analytics /> : null}
  </StrictMode>,
)
