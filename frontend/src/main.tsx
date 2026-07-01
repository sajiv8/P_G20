import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)'
    }}>
      <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          🏫 Campus RSO Platform
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#94a3b8' }}>
          Multi-Tenant Resource Sharing Platform
        </p>
        <p style={{ 
          marginTop: '2rem', 
          padding: '0.75rem 1.5rem', 
          background: '#22c55e22', 
          border: '1px solid #22c55e',
          borderRadius: '8px',
          color: '#22c55e' 
        }}>
          ✅ CI/CD Pipeline Active — Deployed via ArgoCD
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);