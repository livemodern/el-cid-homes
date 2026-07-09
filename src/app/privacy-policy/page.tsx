import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Modern Living Real Estate',
  description: 'Privacy policy for Modern Living Real Estate, including SMS communications policy.',
  robots: { index: false, follow: false },
};

export default function PrivacyPolicyPage() {
  const h2 = { fontFamily: '"Plus Jakarta Sans", Georgia, serif', fontSize: 20, fontWeight: 700, color: '#0D173B', margin: '32px 0 10px' } as const;
  const p = { margin: '0 0 14px' } as const;
  return (
    <main style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 64px', fontFamily: 'Poppins, Arial, sans-serif', color: '#1A1A1A', lineHeight: 1.75, fontSize: 15 }}>
        <h1 style={{ fontFamily: '"Plus Jakarta Sans", Georgia, serif', fontSize: 34, fontWeight: 800, color: '#0D173B', marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 40 }}>Effective: May 20, 2026</p>

        <p style={p}>Modern Living Real Estate (&ldquo;MLG,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is a Florida-licensed real estate brokerage. This Privacy Policy describes how we collect, use, share, and protect personal information about our clients, prospects, and website visitors.</p>

        <h2 style={h2}>1. Information We Collect</h2>
        <p style={p}>We collect personal information you provide directly to us, including when you engage one of our licensed agents, sign a buyer&rsquo;s broker, listing, or lease agreement, attend a property showing, or otherwise communicate with us:</p>
        <ul style={{ paddingLeft: 22, marginBottom: 14 }}>
          <li style={{ marginBottom: 6 }}><strong>Identity information:</strong> full name, mailing address, date of birth (when required for transaction documentation)</li>
          <li style={{ marginBottom: 6 }}><strong>Contact information:</strong> email address, mobile and home phone numbers</li>
          <li style={{ marginBottom: 6 }}><strong>Transaction information:</strong> properties you have bought, sold, or leased through us; offers, contracts, deposits, and closing details</li>
          <li style={{ marginBottom: 6 }}><strong>Financial information</strong> limited to what is required to facilitate a real estate transaction (e.g., proof of funds documentation, mortgage pre-approval references)</li>
          <li style={{ marginBottom: 6 }}><strong>Communications:</strong> notes, messages, and call logs between you and your assigned agent</li>
        </ul>
        <p style={p}>We also collect limited information automatically when you visit our websites: server logs (IP address, user-agent, pages visited), and authentication cookies if you are a logged-in MLG agent or staff member. We do not use third-party advertising trackers.</p>

        <h2 style={h2}>2. How We Use Your Information</h2>
        <ul style={{ paddingLeft: 22, marginBottom: 14 }}>
          <li style={{ marginBottom: 6 }}>Provide real estate brokerage services to you, including representing you in the purchase, sale, or lease of property</li>
          <li style={{ marginBottom: 6 }}>Communicate with you about active and prospective transactions via phone, SMS, email, or postal mail</li>
          <li style={{ marginBottom: 6 }}>Prepare, deliver, and execute real estate contracts and related documents</li>
          <li style={{ marginBottom: 6 }}>Comply with Florida and federal laws applicable to licensed real estate brokerages, including record-retention requirements</li>
          <li style={{ marginBottom: 6 }}>Coordinate with third parties necessary to complete your transaction (see Section 4)</li>
        </ul>

        <h2 style={h2}>3. SMS / Text Messaging</h2>
        <div style={{ background: '#f8f9fa', borderLeft: '4px solid #00B2CC', padding: '20px 24px', borderRadius: '0 8px 8px 0', marginBottom: 16 }}>
          <p style={p}>When you provide your mobile phone number to your assigned MLG agent, you consent to receive SMS messages from that agent and from MLG&rsquo;s broker on matters relating to your active or prospective real estate transaction. SMS messages are one-to-one conversational communications, not bulk marketing.</p>
          <p style={p}><strong>Opt-out at any time</strong> by replying <strong>STOP</strong> to any text message we send you. You will receive a confirmation that you have been unsubscribed, after which we will send no further SMS messages from our system. Standard message and data rates may apply, consult your mobile carrier&rsquo;s pricing.</p>
          <p style={{ margin: 0 }}>We do not share your phone number with third parties for marketing purposes. We do not sell phone numbers under any circumstance.</p>
        </div>

        <h2 style={h2}>4. When We Share Your Information</h2>
        <p style={p}>To complete a real estate transaction we are representing you on, we share information only with parties necessary for that transaction:</p>
        <ul style={{ paddingLeft: 22, marginBottom: 14 }}>
          <li style={{ marginBottom: 6 }}>The counterparty&rsquo;s broker and agent</li>
          <li style={{ marginBottom: 6 }}>Title insurance companies and closing agents handling your closing</li>
          <li style={{ marginBottom: 6 }}>Lenders, mortgage brokers, and appraisers if you authorize us to coordinate with them</li>
          <li style={{ marginBottom: 6 }}>Homeowners&rsquo; and condominium associations when their approval is required for a transaction</li>
          <li style={{ marginBottom: 6 }}>Property inspectors, surveyors, and other licensed professionals you engage</li>
          <li style={{ marginBottom: 6 }}>Service providers who help us operate our business and who are bound by confidentiality obligations</li>
          <li style={{ marginBottom: 6 }}>Government authorities when required by law (e.g., 1099-S reporting on real estate sales)</li>
        </ul>
        <p style={p}>We <strong>do not</strong> share your information with third parties for their marketing purposes. We do not sell personal information.</p>

        <h2 style={h2}>5. Data Retention</h2>
        <p style={p}>We retain transaction records, including communications, contracts, and disclosures, for the period required by Florida real estate brokerage record-keeping rules (currently five (5) years from the close of the transaction, per Florida Real Estate Commission regulations). Records under active litigation or audit are retained for the duration of those proceedings. Inactive prospect records are retained for up to three (3) years unless you request earlier deletion.</p>

        <h2 style={h2}>6. Security</h2>
        <p style={p}>We protect your information using reasonable administrative, technical, and physical safeguards, including encrypted data storage, access controls limiting visibility to the agents and staff working on your matter, and secure cloud infrastructure. No method of electronic transmission or storage is 100% secure; we cannot guarantee absolute security.</p>

        <h2 style={h2}>7. Your Rights</h2>
        <ul style={{ paddingLeft: 22, marginBottom: 14 }}>
          <li style={{ marginBottom: 6 }}>Request access to the personal information we hold about you</li>
          <li style={{ marginBottom: 6 }}>Request correction of inaccurate information</li>
          <li style={{ marginBottom: 6 }}>Request deletion of your information, subject to our legal record-retention obligations</li>
          <li style={{ marginBottom: 6 }}>Opt out of SMS by replying STOP, or of email by following the unsubscribe link in any email</li>
          <li style={{ marginBottom: 6 }}>Withdraw consent for ongoing communications by contacting your agent or the address below</li>
        </ul>

        <h2 style={h2}>8. Children</h2>
        <p style={p}>Our services are not directed to children under 18. We do not knowingly collect personal information from children. If you believe a child has provided us with information, contact us and we will delete it.</p>

        <h2 style={h2}>9. Changes to This Policy</h2>
        <p style={p}>We may update this Privacy Policy from time to time. The &ldquo;Effective&rdquo; date at the top reflects the most recent revision. For material changes, we will provide notice through our website or directly to active clients.</p>

        <h2 style={h2}>10. Contact Us</h2>
        <p style={p}>Modern Living Real Estate<br />480 Hibiscus St Suite 110, West Palm Beach, FL 33401<br />Email: info@modernlivingre.com<br />Phone: (561) 228-8420<br />Web: modernlivingre.com</p>

        <p style={{ marginTop: 48, fontSize: 13, color: '#999' }}>&copy; 2026 Modern Living Real Estate. All rights reserved.</p>
      </div>
    </main>
  );
}
