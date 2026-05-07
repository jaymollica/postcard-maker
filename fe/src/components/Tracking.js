import React, { useState, useEffect } from 'react';
import './Tracking.css';

// Lob's tracking_event types map roughly onto these display labels.
const EVENT_LABELS = {
  in_transit: 'In transit',
  in_local_area: 'In local area',
  processed_for_delivery: 'Processed for delivery',
  delivered: 'Delivered',
  're-routed': 'Re-routed',
  returned_to_sender: 'Returned to sender',
};

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getCurrentStatus(data) {
  if (!data) return 'Loading';
  if (data.tracking_events && data.tracking_events.length > 0) {
    const latest = data.tracking_events[data.tracking_events.length - 1];
    return EVENT_LABELS[latest.type] || latest.name || 'In transit';
  }
  if (data.send_date) return 'Mailed';
  return 'Processing';
}

export default function Tracking({ postcardId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(process.env.REACT_APP_BACKEND_URL + '/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.REACT_APP_FRONTEND_ORIGIN,
      },
      body: JSON.stringify({ postcardId }),
      mode: 'cors',
      credentials: 'same-origin',
      cache: 'no-cache',
    })
      .then(res => res.json())
      .then(json => {
        if (cancelled) return;
        if (json.result === 'error') {
          setError(json.message || 'Could not load tracking info.');
        } else {
          setData(json);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the tracking service. Try again in a moment.');
      });
    return () => { cancelled = true; };
  }, [postcardId]);

  if (error) {
    return (
      <div className="App tracking">
        <h1>Postcard tracking</h1>
        <p className="description">{error}</p>
        <p className="description">Reference: <code>{postcardId}</code></p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="App tracking">
        <h1>Postcard tracking</h1>
        <p className="description">Loading tracking info for <code>{postcardId}</code>&hellip;</p>
      </div>
    );
  }

  const status = getCurrentStatus(data);
  const recipient = data.recipient || {};
  const recipientLine = [recipient.city, recipient.state].filter(Boolean).join(', ');
  const expectedDelivery = formatDate(data.expected_delivery_date);
  const sendDate = formatDate(data.send_date);
  const dateCreated = formatDate(data.date_created);

  // Reverse so most-recent event shows at the top
  const events = [...(data.tracking_events || [])].reverse();

  return (
    <div className="App tracking">
      <h1>Postcard tracking</h1>

      <div className="tracking-status">
        <div className="tracking-status-label">Current status</div>
        <div className="tracking-status-value">{status}</div>
      </div>

      {data.thumbnail && (
        <div className="tracking-thumbnail">
          <img src={data.thumbnail} alt="Postcard preview" />
        </div>
      )}

      <dl className="tracking-meta">
        {recipient.name && (
          <>
            <dt>Recipient</dt>
            <dd>
              {recipient.name}
              {recipientLine && <> &middot; {recipientLine}</>}
              {recipient.country && recipient.country !== 'UNITED STATES' && <> &middot; {recipient.country}</>}
            </dd>
          </>
        )}
        {expectedDelivery && (
          <>
            <dt>Expected delivery</dt>
            <dd>{expectedDelivery}</dd>
          </>
        )}
        {sendDate && (
          <>
            <dt>Mailed</dt>
            <dd>{sendDate}</dd>
          </>
        )}
        {dateCreated && (
          <>
            <dt>Order placed</dt>
            <dd>{dateCreated}</dd>
          </>
        )}
        <dt>Reference</dt>
        <dd><code>{data.id}</code></dd>
      </dl>

      <h2>Timeline</h2>
      {events.length === 0 ? (
        <p className="description">
          No tracking events recorded yet. Postcards typically don&apos;t get scan events until they&apos;re close to the destination &mdash; check back in a few days.
        </p>
      ) : (
        <ol className="tracking-timeline">
          {events.map((ev, i) => (
            <li key={ev.id || i}>
              <div className="tracking-timeline-time">{formatDateTime(ev.time)}</div>
              <div className="tracking-timeline-name">
                {EVENT_LABELS[ev.type] || ev.name || ev.type}
              </div>
              {ev.description && <div className="tracking-timeline-desc">{ev.description}</div>}
              {ev.location && <div className="tracking-timeline-loc">{ev.location}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
