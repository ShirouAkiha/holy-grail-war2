'use client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-serif text-rose-400 mb-3">Something went wrong</h1>
      <p className="text-white/60 mb-6 font-mono text-sm">{error?.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-[#161616] text-[#d4af37] border border-[#d4af37]/40 rounded text-sm hover:bg-[#202020] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
