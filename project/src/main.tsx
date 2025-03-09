import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const basename = import.meta.env.MODE === 'production' ? '/clipboard-image-gallery' : '/'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
