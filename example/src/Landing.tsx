import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Live parameter panels',
    body: 'Sliders, springs, colors, and actions update your UI instantly — no rebuild loop.',
  },
  {
    title: 'Agent notes on any element',
    body: 'Right-click a component, leave a note, and export markdown or JSON for your coding agent.',
  },
  {
    title: 'VisBug-style CSS editing',
    body: 'Tweak styles inline, undo changes, and copy a CSS patch when you are happy.',
  },
  {
    title: 'Works in your app or via extension',
    body: 'Mount DialRoot with devSession in React, Solid, Svelte, or Vue — or inject on any page with the Chrome extension.',
  },
];

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-hero">
        <p className="landing-eyebrow">DialKit · maceip fork</p>
        <h1>Design in the browser. Ship notes agents can read.</h1>
        <p className="landing-lead">
          DialKit is a live tweaking panel for motion and layout. This fork adds a dev session:
          annotate the page, edit CSS, link dial panels to DOM nodes, and export a review package.
        </p>
        <div className="landing-cta">
          <Link className="landing-btn landing-btn-primary" to="/demo">
            Open interactive demo
          </Link>
          <a
            className="landing-btn"
            href="https://github.com/maceip/dialkit"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </header>

      <section className="landing-grid">
        {features.map((feature) => (
          <article key={feature.title} className="landing-card">
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="landing-steps">
        <h2>Try the dev session in 30 seconds</h2>
        <ol>
          <li>Open the <Link to="/demo">demo page</Link> and expand the DialKit panel.</li>
          <li>Right-click the photo title or stack — choose <strong>Leave note</strong>.</li>
          <li>Save the note, reload the page, and find it under <strong>Agent notes</strong>.</li>
          <li>Hit <strong>Copy for agent</strong> to grab markdown with selectors and dial snapshots.</li>
        </ol>
      </section>

      <footer className="landing-footer">
        <p>
          Built on Josh Puckett&apos;s DialKit. MIT licensed.
        </p>
      </footer>
    </div>
  );
}
