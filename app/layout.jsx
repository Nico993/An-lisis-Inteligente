import { Fraunces, JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Análisis Inteligente — Operaciones Rappi',
  description: 'Chat con datos y reporte de insights automáticos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${outfit.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className="app-body">{children}</body>
    </html>
  );
}
