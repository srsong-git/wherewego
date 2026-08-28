import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import KakaoLinksDebugPage from './components/KakaoLinksDebugPage.jsx'
import './styles.css'

const isKakaoLinksDebugPage = window.location.pathname.replace(/\/+$/, '') === '/debug/kakao-links'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isKakaoLinksDebugPage ? <KakaoLinksDebugPage /> : <App />}
    {!isKakaoLinksDebugPage ? <Analytics /> : null}
  </StrictMode>,
)
