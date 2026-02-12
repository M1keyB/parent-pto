import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './context/AuthContext';
import { HouseholdProvider } from './context/HouseholdContext';
import { ToastProvider } from './context/ToastContext';
import App from './App';
import './index.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <HouseholdProvider>
            <App />
          </HouseholdProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

