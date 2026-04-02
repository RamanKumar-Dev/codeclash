import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1A1A2E',
            color: '#E0E0E0',
            border: '1px solid #2A2A3E',
          },
          success: {
            iconTheme: {
              primary: '#00FF88',
              secondary: '#0A0A0F',
            },
          },
          error: {
            iconTheme: {
              primary: '#FF4444',
              secondary: '#0A0A0F',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
