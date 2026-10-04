let loadedCanvas: any = null;

function getRuntimeRequire(): ((id: string) => any) | null {
  try {
    if (typeof __non_webpack_require__ !== 'undefined') {
      return __non_webpack_require__;
    }
  } catch {
    // ignore
  }

  try {
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).require === 'function') {
      return (import.meta as any).require;
    }
  } catch {
    // ignore
  }

  try {
    const req = eval('require');
    if (typeof req === 'function') {
      return req;
    }
  } catch {
    // ignore
  }

  return null;
}

export function getCanvasModule(): any {
  if (loadedCanvas && typeof loadedCanvas.createCanvas === 'function') {
    return loadedCanvas;
  }

  const candidateNames = [
    '@napi-rs/canvas',
    '@napi-rs/canvas-win32-x64-msvc',
    '@napi-rs/canvas-win32-ia32-msvc',
    '@napi-rs/canvas-win32-arm64-msvc',
    '@napi-rs/canvas-linux-x64-gnu',
    '@napi-rs/canvas-darwin-x64',
    '@napi-rs/canvas-darwin-arm64',
    'canvas'
  ];

  const req = getRuntimeRequire();
  if (req) {
    for (const name of candidateNames) {
      try {
        const mod = req(name);
        if (mod && (typeof mod.createCanvas === 'function' || typeof mod.default?.createCanvas === 'function')) {
          loadedCanvas = mod.createCanvas ? mod : mod.default;
          return loadedCanvas;
        }
      } catch {
        // Continue trying
      }
    }
  }

  console.error('❌ CRITICAL: Failed to load @napi-rs/canvas native module via all loaders.');
  return null;
}

let loadedGifenc: any = null;
export function getGifencModule(): any {
  if (loadedGifenc) return loadedGifenc;

  const candidateNames = ['gifenc'];
  const req = getRuntimeRequire();
  if (req) {
    for (const name of candidateNames) {
      try {
        const mod = req(name);
        if (mod) {
          loadedGifenc = mod.GIFEncoder || mod.default?.GIFEncoder ? (mod.GIFEncoder ? mod : mod.default) : mod;
          return loadedGifenc;
        }
      } catch {
        // Continue trying
      }
    }
  }

  return null;
}
