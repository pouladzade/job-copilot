import { render } from 'preact';

export function App(): preact.JSX.Element {
  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '18px', marginBottom: '12px' }}>AI Job Copilot</h1>
      <p style={{ color: '#666', marginBottom: '16px' }}>Navigate to a supported job posting and click "Scrape & Tailor" to get started.</p>
      <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', fontSize: '13px' }}>
        <strong>Status:</strong> Ready
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app') as HTMLElement);