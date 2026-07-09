'use client'

// Carrier-required SMS consent — explicit unchecked-by-default checkbox
// for any form that captures a phone number.
//
// Why a checkbox (not just disclosure text): A2P 10DLC reviewers reject
// campaigns whose registration forms imply consent ("by entering your
// number, you agree…"). Twilio error 30925: "opt-in checkbox is missing
// or appears to be pre-selected." Carriers want explicit, separately-
// clicked, unchecked-by-default consent. This is also TCPA "express
// written consent" — the gold standard for SMS opt-in evidence.
//
// Mirror of mlg-site/src/components/SmsConsentDisclosure.tsx — keep in
// lockstep. Disclosure text MUST match the text quoted in the Twilio
// A2P campaign message_flow field verbatim, or the carrier reviewer
// rejects for mismatch (error 30891).

import React, { useState } from 'react'

const SLATE = '#64748b'
const NAVY  = '#0D173B'
const TEAL  = '#00B2CC'
const BODY  = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

// Privacy URL on the canonical public brand domain — modernlivingre.com,
// not mlrecloud.com (mlrecloud.com is internal infra and would fail the
// Twilio brand-verification check, contributing to 30891). Cross-check
// between what appears here and what's on the campaign is exactly what
// Twilio reviewers verify; keep this URL in lockstep with the campaign's
// Privacy Policy URL field. Patrick 2026-06-29.
const PRIVACY_URL = 'https://www.modernlivingre.com/privacy-policy'

// Verbatim disclosure copy. Exported so the server can store the exact
// text shown at consent time (TCPA evidence) alongside the timestamp.
export const SMS_CONSENT_TEXT =
  'I agree to receive SMS messages from Modern Living Group at the number above ' +
  'about my real estate inquiry. Message frequency varies based on my conversation ' +
  'with my agent. Msg & data rates may apply. Reply STOP to opt out at any time. ' +
  'Reply HELP for help. See the privacy policy at ' + PRIVACY_URL + '.'

export default function SmsConsentDisclosure({
  checked,
  onChange,
  style,
}: {
  /** Controlled checked state. If omitted, the component manages its own
   *  state — the visual + HTML5 required validation still works, but the
   *  consent value isn't surfaced to the form's submit handler. Use the
   *  controlled form (pass both checked and onChange) on any form that
   *  POSTs consent to the server for TCPA persistence. */
  checked?: boolean
  onChange?: (checked: boolean) => void
  /** Optional style overrides (margins) for tighter form layouts. */
  style?: React.CSSProperties
}) {
  // Self-managed state when the parent doesn't pass props — keeps the
  // checkbox visible + required even on forms that haven't been retro-
  // fitted to thread consent through their submit handler yet.
  const [internalChecked, setInternalChecked] = useState(false)
  const isControlled = onChange !== undefined
  const value  = isControlled ? !!checked : internalChecked
  const setter = isControlled ? onChange! : setInternalChecked

  return (
    <label
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        fontSize: 11,
        lineHeight: 1.5,
        color: SLATE,
        fontFamily: BODY,
        marginTop: 6,
        marginBottom: 12,
        cursor: 'pointer',
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={e => setter(e.target.checked)}
        // HTML5 required — blocks the form submit when unchecked, even
        // without parent-side validation logic. Carrier-compliant default.
        required
        style={{
          marginTop: 2,
          width: 16,
          height: 16,
          flexShrink: 0,
          accentColor: TEAL,
          cursor: 'pointer',
        }}
      />
      <span style={{ color: NAVY }}>
        I agree to receive SMS messages from{' '}
        <strong>Modern Living Group</strong> at the number above about my real estate inquiry.
        Message frequency varies based on my conversation with my agent.
        Msg &amp; data rates may apply. Reply <strong>STOP</strong> to opt out at any time.
        Reply <strong>HELP</strong> for help. See our{' '}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: TEAL, textDecoration: 'underline' }}>
          privacy policy
        </a>
        .
      </span>
    </label>
  )
}
