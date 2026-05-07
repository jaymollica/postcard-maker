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
    // Any extra keys become merge variables on the postcard
    title: 'Untitled',
    attribution: 'Anonymous',
    date: '2026',
    source: 'My Project',
    userMessage: 'Hi from the internet!',
  });
</script>`;

export default function Landing() {
  return (
    <div className="App landing">
      <div className="landing-section landing-hero">
        <h1>Sweet Post</h1>
        <p className="description">
          A drop-in service that lets any browser-based art project mail a physical 4&times;6&quot; postcard
          of an image rendered in a <code>&lt;canvas&gt;</code>. Visitors fill in a recipient address, pay,
          and we mail the postcard.
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
        <h2>Merge variables</h2>
        <p className="description">
          Any extra keys you pass to <code>Lobby()</code> beyond <code>button</code> and <code>canvas</code> become merge variables on the postcard. The default templates render the variables below — pass them to fill in the corresponding <code>{'{{variableName}}'}</code> placeholders. Variables marked <em>auto</em> are filled in automatically.
        </p>

        <h3 className="landing-subhead">About the subject</h3>
        <ul className="landing-vars">
          <li><code>title</code> &mdash; what's being presented</li>
          <li><code>attribution</code> &mdash; who made it</li>
          <li><code>date</code> &mdash; when it was made</li>
          <li><code>source</code> &mdash; where it's from (collection, project, etc.)</li>
          <li><code>imageURL</code> <em>(auto)</em> &mdash; the canvas image, set from the upload</li>
        </ul>

        <h3 className="landing-subhead">From the buyer</h3>
        <ul className="landing-vars">
          <li><code>userMessage</code> &mdash; personal note the buyer wants on the card</li>
        </ul>

        <h3 className="landing-subhead">Footer &amp; branding</h3>
        <p className="description landing-vars-note">All have sensible defaults; pass these to override.</p>
        <ul className="landing-vars">
          <li><code>footerHeader</code> &mdash; small heading near the bottom of the back</li>
          <li><code>footerMessage</code> &mdash; short paragraph explaining the postcard or your project</li>
          <li><code>footerUrl</code> &mdash; URL printed in plain text in the footer</li>
          <li><code>qrCodeUrl</code> &mdash; URL the QR code on the back encodes (defaults to your site URL, so recipients can scan to visit your project)</li>
        </ul>

        <p className="description">
          Legacy artwork-prefixed names (<code>artworkTitle</code>, <code>artworkArtist</code>, <code>artworkYear</code>, <code>artworkMuseum</code>, <code>artworkImageURL</code>) are still accepted and aliased to the new names server-side, so existing integrations don't need to change.
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
