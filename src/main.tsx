import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { firebaseConfigured } from './lib/firebase'

const root = createRoot(document.getElementById("root")!);

if (!firebaseConfigured) {
  root.render(
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f1f5f9', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Monopoly Madness isn't configured</h1>
        <p style={{ lineHeight: 1.6, color: '#cbd5e1' }}>
          This deployment has no Firebase settings. Add the <code>VITE_FIREBASE_*</code> environment variables
          (see <code>.env.example</code> and the README) and redeploy.
        </p>
      </div>
    </div>
  );
} else {
  root.render(<App />);
}
