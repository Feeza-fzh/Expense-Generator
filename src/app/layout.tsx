import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Receipt to Expense Report',
  description: 'Turn receipts into structured expense reports',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-surface text-on-surface">
        {children}
      </body>
    </html>
  );
}

