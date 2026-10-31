import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Signal to watchdog in index.html that React modules have evaluated
(window as any).__bancaGeekMounted = true;

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err: any) {
    console.error('[Banca Geek Boot Error]', err);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #12121F; color: #F4EBD8; font-family: sans-serif; text-align: center; padding: 24px;">
        <div style="font-size: 22px; font-weight: 900; color: #FFC531; text-transform: uppercase; margin-bottom: 12px;">BANCA GEEK - MODO DE SEGURANÇA</div>
        <p style="font-size: 13px; color: #8A8CA5; max-width: 400px; margin-bottom: 20px;">Ocorreu uma inconsistência no cache local durante a inicialização.</p>
        <button onclick="window.__bancaGeekForceReload()" style="padding: 12px 24px; background: #FFC531; color: #12121F; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; text-transform: uppercase;">
          Limpar Cache e Reiniciar
        </button>
      </div>
    `;
  }
} else {
  console.error('[Banca Geek] Elemento root não encontrado no documento.');
}
