export const metadata = {
  title: 'El Cid Homes | Historic West Palm Beach',
  description:
    'El Cid — a historic U.S. district in the heart of West Palm Beach, lining the Flagler Drive waterfront directly across from Palm Beach. Homes for sale and rent, coming soon from Modern Living Group at Compass.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,600;1,700&family=Poppins:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Poppins', sans-serif", background: '#0D173B' }}>
        {children}
      </body>
    </html>
  );
}
