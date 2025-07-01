import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // 기본 스타일시트 (아래에 생성)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
