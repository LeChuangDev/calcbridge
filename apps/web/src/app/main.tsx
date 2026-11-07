import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { ThemeProvider } from '@/shared/lib/providers/ThemeProvider';
import { UnitSystemProvider } from '@/shared/lib/providers/UnitSystemProvider';
import '@/app/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <UnitSystemProvider>
        <App />
      </UnitSystemProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
