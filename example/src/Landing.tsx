import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Live parameter panels',
    body: 'Sliders, springs, colors, and actions update your UI instantly — no rebuild loop.',
  },
  {
    title: 'Annotation toolbar',
    body: 'Click, select text, multi-select, or drag an area — leave markers and copy structured markdown for your coding agent (localStorage only).',
  },
  {
    title: 'Live CSS + element dials',
    body: 'Right-click to edit styles, open a dial panel on the element, or move it — copy a CSS patch when you are happy.',
  },
  {
    title: 'Works in your React app',
    body: 'Mount DialRoot with devSession. Annotation toolbar is React-first; Solid/Vue/Svelte still get the slim CSS/dial/move host.',
  },
];


export function Landing() {
  return (
    <div className="landing">
      <header className="landing-hero">
        <p className="landing-eyebrow">
      <img className="landing-logo" src={`${import.meta.env.BASE_URL}icons/icon-light-128.png`} alt="" />
      DialKit · maceip fork
    </p>
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
        <h2>Try annotations in 30 seconds</h2>
        <ol>
          <li>Open the <Link to="/demo">demo page</Link> and click the floating annotation toolbar.</li>
          <li>Click an element, add a comment, and place a marker.</li>
          <li>Reload — markers persist via localStorage.</li>
          <li>Copy feedback from the toolbar, or right-click for <strong>Edit styles</strong> / <strong>Open dial panel</strong>.</li>
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
