import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DialRoot } from 'dialkit';
import 'dialkit/styles.css';
import './landing.css';
import { Landing } from './Landing';
import { PhotoStack } from './PhotoStack';
import { Release } from './Release';

function DemoPage() {
  return (
    <>
      <PhotoStack />
      <DialRoot
        position="top-right"
        productionEnabled
        devSession={{ projectKey: 'dialkit-example' }}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/release-1.2" element={<Release />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
