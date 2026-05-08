import React from 'react';
import './Landing.css';

const PROJECTS = [
  {
    name: 'SweetPost',
    url: 'https://sweetpost.art',
    description: 'Generative postcards from public-domain art collections.',
  },
];

export default function Landing() {
  return (
    <div className="App landing">
      <div className="landing-section landing-hero">
        <h1>Ollie Mail</h1>
        <p className="landing-tagline">Enjoy getting mail again!</p>
        <p className="description">
          Ollie Mail is a drop-in service that lets you easily mail a physical postcard of an image of your choice.
        </p>
        <p className="description">
          Any artist, museum or gallery can easily begin to monetize their work or collection with Ollie Mail. If you are interested in joining our service you can reach us at <a className="backlink" href="mailto:support@olliemail.net">support@olliemail.net</a>.
        </p>
      </div>

      <div className="landing-section">
        <h2>How it works</h2>
        <ol className="landing-steps">
          <li>You embed a small JS snippet on your site, alongside a <code>&lt;canvas&gt;</code> and a button.</li>
          <li>A visitor generates artwork however your project works.</li>
          <li>They click your button and land on Ollie Mail with their image attached.</li>
          <li>They enter a recipient address, pay, and we mail the postcard within a few days.</li>
        </ol>
      </div>

      <div className="landing-section">
        <h2>Projects on the platform</h2>
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

      <div className="landing-section">
        <h2>For developers</h2>
        <p className="description">
          Embed reference, canvas sizing for print, merge variable docs, and an interactive setup assistant live in the <a className="backlink" href="/developers">developer portal</a>.
        </p>
      </div>

      <div className="landing-section">
        <h2>Join the platform</h2>
        <p className="description">
          We're always interested in adding new projects. If you'd like to bring olliemail to your site, drop a note to <a className="backlink" href="mailto:support@olliemail.net">support@olliemail.net</a>.
        </p>
      </div>
    </div>
  );
}
