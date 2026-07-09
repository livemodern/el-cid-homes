import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Modern Living Real Estate',
  description: 'Terms of service and SMS program terms for Modern Living Real Estate.',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  const h2 = { fontFamily: '"Plus Jakarta Sans", Georgia, serif', fontSize: 20, fontWeight: 700, color: '#0D173B', margin: '32px 0 10px' } as const;
  const p = { margin: '0 0 14px' } as const;
  return (
    <main style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 64px', fontFamily: 'Poppins, Arial, sans-serif', color: '#1A1A1A', lineHeight: 1.75, fontSize: 15 }}>
        <h1 style={{ fontFamily: '"Plus Jakarta Sans", Georgia, serif', fontSize: 34, fontWeight: 800, color: '#0D173B', marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 40 }}>Effective: May 20, 2026</p>

        <p style={p}>These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the websites operated by Modern Living Real Estate (&ldquo;MLG,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), including modernlivingre.com and elcidhomes.com, and any SMS, email, or other electronic communications between you and our licensed real estate agents. By using our websites or by providing your phone number to a MLG agent, you agree to these Terms and to our <a href="/privacy-policy" style={{ color: '#00B2CC' }}>Privacy Policy</a>.</p>

        <h2 style={h2}>1. Brokerage Services</h2>
        <p style={p}>MLG is a Florida-licensed real estate brokerage. Our agents represent buyers, sellers, landlords, and tenants in real estate transactions. The specific scope of brokerage representation is defined in the brokerage agreement (Buyer Broker, Exclusive Right of Sale Listing, or Exclusive Right to Lease) signed between you and MLG. Nothing on our website creates a brokerage relationship by itself; representation begins when both parties sign a written brokerage agreement.</p>

        <h2 style={h2}>2. SMS Program Terms</h2>
        <div style={{ background: '#f8f9fa', borderLeft: '4px solid #00B2CC', padding: '20px 24px', borderRadius: '0 8px 8px 0', marginBottom: 16 }}>
          <p style={p}><strong>Program name:</strong> Modern Living Real Estate SMS</p>
          <p style={p}><strong>Description:</strong> SMS communications between MLG&rsquo;s licensed real estate agents and clients with active buyer, seller, or rental transactions. Messages cover showing appointments, contract deadlines, document signing requests, closing logistics, and other transaction-related matters. Messages are conversational and transactional, not marketing or promotional.</p>
          <p style={p}><strong>How you opt in:</strong> You opt in to receive SMS from MLG by providing your mobile phone number to your assigned MLG agent during the engagement process, either verbally during consultation or in writing on a Florida Realtors brokerage agreement.</p>
          <p style={p}><strong>Message frequency:</strong> Varies based on the activity of your transaction. Conversational, not scheduled or recurring.</p>
          <p style={p}><strong>Message and data rates may apply.</strong> Consult your mobile carrier&rsquo;s pricing.</p>
          <p style={p}><strong>To opt out:</strong> Reply <strong>STOP</strong> to any message from us. You will receive a final confirmation that you have been unsubscribed, after which we will send no further SMS messages from our system. You may also instruct your agent verbally to remove your number.</p>
          <p style={p}><strong>For help:</strong> Reply <strong>HELP</strong> to any message, or contact info@modernlivingre.com.</p>
          <p style={{ margin: 0 }}>We do not share your phone number with third parties for marketing purposes. See our <a href="/privacy-policy" style={{ color: '#00B2CC' }}>Privacy Policy</a> for more on how we handle your information.</p>
        </div>

        <h2 style={h2}>3. Website Use</h2>
        <p style={p}>You may use our websites for lawful purposes only. You agree not to:</p>
        <ul style={{ paddingLeft: 22, marginBottom: 14 }}>
          <li style={{ marginBottom: 6 }}>Attempt unauthorized access to administrative or staff portions of our sites</li>
          <li style={{ marginBottom: 6 }}>Scrape, copy, or redistribute property listings or other content without permission</li>
          <li style={{ marginBottom: 6 }}>Use the sites to transmit malicious code, spam, or other harmful content</li>
          <li style={{ marginBottom: 6 }}>Misrepresent your identity or affiliation with MLG</li>
        </ul>
        <p style={p}>We reserve the right to suspend or terminate access for any user violating these Terms.</p>

        <h2 style={h2}>4. Property Information Disclaimer</h2>
        <p style={p}>Property listings, descriptions, photographs, and market data shown on our websites are obtained from sources we believe reliable, including third-party Multiple Listing Services (MLS), but are not guaranteed accurate or current. Square footage, lot size, year built, property condition, and other particulars should be independently verified by the buyer or tenant. MLG and its agents make no representation or warranty as to the accuracy of third-party data.</p>

        <h2 style={h2}>5. Limitation of Liability</h2>
        <p style={p}>To the maximum extent permitted by law, MLG and its agents, employees, officers, and affiliates are not liable for indirect, incidental, consequential, special, or punitive damages arising from your use of our websites or SMS program. Our total liability for any claim arising from these Terms is limited to the amount of commission, if any, paid to or by you in connection with a transaction in which MLG represented you.</p>

        <h2 style={h2}>6. Governing Law</h2>
        <p style={p}>These Terms are governed by the laws of the State of Florida, without regard to its conflict-of-laws principles. Any dispute will be resolved in the state or federal courts located in Palm Beach County, Florida, unless the parties agree to mediation or arbitration as required by a separately-signed brokerage agreement.</p>

        <h2 style={h2}>7. Changes to These Terms</h2>
        <p style={p}>We may update these Terms from time to time. The &ldquo;Effective&rdquo; date at the top reflects the most recent revision. Continued use of our websites or SMS program after a revision constitutes acceptance.</p>

        <h2 style={h2}>8. Contact Us</h2>
        <p style={p}>Modern Living Real Estate<br />480 Hibiscus St Suite 110, West Palm Beach, FL 33401<br />Email: info@modernlivingre.com<br />Phone: (561) 228-8420<br />Web: modernlivingre.com</p>

        <p style={{ marginTop: 48, fontSize: 13, color: '#999' }}>&copy; 2026 Modern Living Real Estate. All rights reserved.</p>
      </div>
    </main>
  );
}
