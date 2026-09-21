import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-serif text-[#d4af37] mb-3">404 - Page Not Found</h1>
      <p className="text-white/60 mb-6 font-mono text-sm">The requested resource could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-[#161616] text-[#d4af37] border border-[#d4af37]/40 rounded text-sm hover:bg-[#202020] transition-colors"
      >
        Return to Command Center
      </Link>
    </div>
  );
}
