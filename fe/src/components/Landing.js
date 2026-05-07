import React from 'react';
import './Landing.css';

const PROJECTS = [
  {
    name: 'SweetPost',
    url: 'https://sweetpost.art',
    description: 'Generative postcards from public-domain art collections.',
  },
];

const EMBED_EXAMPLE = `<!-- Drop the embed script after your canvas + button -->
<canvas class="my-canvas"></canvas>
<button class="my-button">Make a postcard</button>

<script src="https://olliemail.net/embed/"></script>
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
        <h1>olliemail</h1>
        <p className="landing-tagline">Enjoy getting mail again!</p>
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
          <li>They click your button and land on olliemail with their image attached.</li>
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
          Domains must be allowlisted before they can use the service. As part of allowlisting, the artist (or maker, or developer) sets the per-postcard price &mdash; with separate values for US and international orders &mdash; so you choose what your audience pays.
        </p>
      </div>

      <div className="landing-section">
        <h2>Sizing your canvas for print</h2>
        <p className="description">
          olliemail prints at <strong>300 DPI</strong> — one inch on the postcard equals 300 pixels on your <code>&lt;canvas&gt;</code>. Match your canvas to the full-bleed dimensions of the size you're targeting and keep important artwork inside the safe zone. Bleed pixels get trimmed off; content too close to the trim line risks being cut.
        </p>

        <div className="landing-print-diagram">
          <svg viewBox="0 0 600 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram of a 4 by 6 inch postcard showing bleed, trim, and safe zone regions">
            <rect x="50" y="60" width="500" height="340" fill="#e8e8e8" />
            <rect x="60" y="70" width="480" height="320" fill="#fafafa" stroke="#000" strokeWidth="1" strokeDasharray="6 4" />
            <rect x="70" y="80" width="460" height="300" fill="#ffffff" stroke="#888" strokeWidth="1" strokeDasharray="3 3" />
            <text x="300" y="38" textAnchor="middle" fontSize="13" fill="#555">Full bleed — 1875 × 1275 px (6.25 × 4.25&quot;)</text>
            <text x="300" y="225" textAnchor="middle" fontSize="14" fontWeight="500" fill="#000">Safe zone</text>
            <text x="300" y="244" textAnchor="middle" fontSize="12" fill="#555">1725 × 1125 px · keep important content here</text>
            <text x="300" y="425" textAnchor="middle" fontSize="13" fill="#555">Trim — final 4 × 6&quot; (1800 × 1200 px)</text>
          </svg>
          <p className="landing-print-caption">4 × 6&quot; postcard front, shown landscape</p>
        </div>

        <h3 className="landing-subhead">Recommended canvas dimensions</h3>
        <table className="landing-print-table">
          <thead>
            <tr><th>Postcard size</th><th>Canvas (landscape)</th><th>Safe zone</th></tr>
          </thead>
          <tbody>
            <tr><td>4 × 6&quot;</td><td>1875 × 1275 px</td><td>1725 × 1125 px</td></tr>
            <tr><td>6 × 9&quot;</td><td>2775 × 1875 px</td><td>2625 × 1725 px</td></tr>
            <tr><td>6 × 11&quot;</td><td>3375 × 1875 px</td><td>3225 × 1725 px</td></tr>
          </tbody>
        </table>

        <p className="description">
          Smaller canvases get upscaled and look soft; larger ones are downscaled (fine, just wastes bandwidth). The embed uploads your canvas as a JPEG, so single-pixel lines and dithered patterns can soften slightly during compression — favor anti-aliased shapes and strokes a few pixels thick if sharpness matters.
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
        <h2>Projects using olliemail</h2>
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
