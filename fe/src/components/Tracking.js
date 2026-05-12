import React, { useState, useEffect } from 'react';
import './Tracking.css';
import { track } from './../analytics.js';

// Lob's tracking_event types map roughly onto these display labels (used
// in the "Recent activity" detail list below the main step view).
const EVENT_LABELS = {
  in_transit: 'In transit',
  in_local_area: 'In local area',
  processed_for_delivery: 'Processed for delivery',
  delivered: 'Delivered',
  're-routed': 'Re-routed',
  returned_to_sender: 'Returned to sender',
};

// The visible steps, in order. Each step has:
//   - key: identifier
//   - label: shown to user
//   - reachedAt: index in STATUS_ORDER at or after which this step is "done"
const STEPS = [
  { key: 'order_placed',     label: 'Order placed' },
  { key: 'printed',          label: 'Printed' },
  { key: 'mailed',           label: 'Mailed' },
  { key: 'in_transit',       label: 'In transit' },
  { key: 'in_local_area',    label: 'Near recipient' },
  { key: 'delivered',        label: 'Delivered' },
];

// Map Lob postcard.status to "which step we've reached". Anything not listed
// is treated as step 0 (just placed).
const STATUS_TO_STEP_INDEX = {
  created:                0,
  ready:                  1,
  processed:              1,
  printed:                1,
  mailed:                 2,
  in_transit:             3,
  in_local_area:          4,
  processed_for_delivery: 4,
  delivered:              5,
  // Terminal-but-not-delivered states. Treat as roughly "in transit" — the
  // detailed events list below will show the actual reason.
  're_routed':            3,
  're-routed':            3,
  returned_to_sender:     3,
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

// Find the earliest tracking_event whose type matches any of `types`. Returns
// the event time or null.
function firstEventTimeOfType(events, types) {
  if (!events) return null;
  for (const ev of events) {
    if (types.includes(ev.type)) return ev.time;
  }
  return null;
}

// Compute the display date for each step from the postcard data.
function buildStepRows(data) {
  const events = data.tracking_events || [];
  const currentStepIdx = STATUS_TO_STEP_INDEX[data.status] ?? 0;

  return STEPS.map((step, idx) => {
    let date = null;
    let datePrefix = '';

    switch (step.key) {
      case 'order_placed':
        date = data.date_created;
        break;
      case 'printed':
        // Lob doesn't expose a separate "printed at" timestamp; if we've
        // reached this step or beyond, the send_date is close enough since
        // print+mail happen the same day.
        if (idx <= currentStepIdx) date = data.send_date || data.date_created;
        break;
      case 'mailed':
        date = data.send_date;
        break;
      case 'in_transit':
        date = firstEventTimeOfType(events, ['in_transit']);
        break;
      case 'in_local_area':
        date = firstEventTimeOfType(events, ['in_local_area', 'processed_for_delivery']);
        break;
      case 'delivered':
        date = firstEventTimeOfType(events, ['delivered']);
        if (!date && data.expected_delivery_date) {
          date = data.expected_delivery_date;
          datePrefix = 'Expected ';
        }
        break;
      default: break;
    }

    return {
      ...step,
      done: idx <= currentStepIdx,
      current: idx === currentStepIdx,
      date,
      datePrefix,
    };
  });
}

export default function Tracking({ postcardId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    track('tracking_viewed', { postcard_id: postcardId });
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

  const steps = buildStepRows(data);
  const recipient = data.recipient || {};
  const recipientLine = [recipient.city, recipient.state].filter(Boolean).join(', ');
  const dateCreated = formatDate(data.date_created);

  // Reverse-chrono detail list (USPS scan events)
  const events = [...(data.tracking_events || [])].reverse();

  return (
    <div className="App tracking">
      <h1>Postcard tracking</h1>

      {data.thumbnail && (
        <div className="tracking-thumbnail">
          <img src={data.thumbnail} alt="Postcard preview" />
        </div>
      )}

      <ol className="tracking-steps">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={`tracking-step ${step.done ? 'is-done' : ''} ${step.current ? 'is-current' : ''}`}
          >
            <div className="tracking-step-marker" aria-hidden="true">
              {step.done ? '●' : '○'}
            </div>
            <div className="tracking-step-body">
              <div className="tracking-step-label">{step.label}</div>
              <div className="tracking-step-date">
                {step.date
                  ? `${step.datePrefix}${formatDate(step.date)}`
                  : <span className="muted">&mdash;</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>

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
        {dateCreated && (
          <>
            <dt>Order placed</dt>
            <dd>{dateCreated}</dd>
          </>
        )}
        {data.carrier && (
          <>
            <dt>Carrier</dt>
            <dd>{data.carrier}</dd>
          </>
        )}
        <dt>Reference</dt>
        <dd><code>{data.id}</code></dd>
      </dl>

      {events.length > 0 && (
        <>
          <h2>Recent activity</h2>
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
        </>
      )}
    </div>
  );
}
