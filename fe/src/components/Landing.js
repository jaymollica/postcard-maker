import React from 'react';
import './Landing.css';

const PROJECTS = [
  {
    name: 'SweetPost',
    url: 'https://sweetpost.art',
    description: 'Generative postcards from public-domain art collections.',
  },
  {
    name: 'Dapper as Fuck',
    url: 'https://dapperasfuck.com',
    description: '',
  },
];

const EMBED_EXAMPLE = `<!-- Drop the embed script after your canvas + button -->
<canvas class="my-canvas"></canvas>
<button class="my-button">Make a postcard</button>

<script src="https://mail.sweetpost.art/embed/"></script>
<script>
  Lobby({
    button: '.my-button',
    canvas: '.my-canvas',
    title: 'Untitled',
    attribution: 'Anonymous',
    date: '2026',
  });
</script>`;

export default function Landing() {
  return (
    <div className="App landing">
      <div className="landing-section landing-hero">
        <h1>Sweet Post</h1>
        <p className="description">
          A drop-in service that lets any browser-based art project mail a physical 4&times;6&quot; postcard
          of an image rendered in a <code>&lt;canvas&gt;</code>. Visitors fill in a recipient address, pay via
          Stripe, and <a className="backlink" href="https://lob.com" target="_blank" rel="noreferrer">Lob</a> prints and ships the card.
        </p>
      </div>

      <div className="landing-section">
        <h2>How it works</h2>
        <ol className="landing-steps">
          <li>You embed a small JS snippet on your site, alongside a <code>&lt;canvas&gt;</code> and a button.</li>
          <li>A visitor generates artwork however your project works.</li>
          <li>They click your button and land on Sweet Post with their image attached.</li>
          <li>They enter a recipient address, pay, and we mail the postcard within a few days.</li>
        </ol>
      </div>

      <div className="landing-section">
        <h2>For developers</h2>
        <p className="description">
          Include the embed script after your canvas + button, then call <code>Lobby()</code> with selectors for each:
        </p>
        <pre className="landing-code">{EMBED_EXAMPLE}</pre>
        <p className="description">
          Domains must be allowlisted before they can use the service. Full integration docs and the source for this project are on{' '}
          <a className="backlink" href="https://github.com/jaymollica/postcard-maker" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </div>

      <div className="landing-section">
        <h2>Projects using Sweet Post</h2>
        <ul className="landing-projects">
          {PROJECTS.map(p => (
            <li key={p.url}>
              <a className="backlink" href={p.url} target="_blank" rel="noreferrer">
                {p.name}
              </a>
              {p.description && <span className="landing-project-desc"> &mdash; {p.description}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
