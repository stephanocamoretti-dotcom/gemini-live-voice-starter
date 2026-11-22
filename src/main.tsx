import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VoiceConsole } from './components/VoiceConsole';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VoiceConsole />
  </StrictMode>
);
