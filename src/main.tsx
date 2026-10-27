import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary, NoWebGL, hasWebGL } from './ui/Fallback';
import './ui/styles.css';
import { installDebug } from './debug';
import { attachAudio } from './game/audioBridge';
import { store } from './game/store';

installDebug();
attachAudio(store);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>{hasWebGL() ? <App /> : <NoWebGL />}</ErrorBoundary>
  </StrictMode>,
);
