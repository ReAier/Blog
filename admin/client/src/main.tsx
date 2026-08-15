import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { initializeAppearance } from './lib/preferences';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root mount point');

initializeAppearance();

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
