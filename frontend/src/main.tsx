import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('De root van de applicatie ontbreekt.');
}

createRoot(rootElement).render(<App />);
