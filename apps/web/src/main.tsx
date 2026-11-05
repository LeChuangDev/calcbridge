import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { UnitSystemProvider } from '@/providers/UnitSystemProvider';
import '@/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <UnitSystemProvider>
        <App />
      </UnitSystemProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
