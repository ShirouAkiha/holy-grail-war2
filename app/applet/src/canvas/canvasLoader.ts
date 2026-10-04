import path from 'path';
import { createRequire } from 'module';

let loadedCanvas: any = null;

export function getCanvasModule(): any {
  if (loadedCanvas && typeof loadedCanvas.createCanvas === 'function') {
    return loadedCanvas;
  }

  // Build list of module resolution functions compatible with Node, Bun, Windows, Linux, and Next.js Webpack
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

  const requireHooks: ((name: string) => any)[] = [
    // 1. Bun runtime import.meta.require
    (name: string) => {
      if (typeof import.meta !== 'undefined' && typeof (import.meta as any).require === 'function') {
        return (import.meta as any).require(name);
      }
      return null;
    },
    // 2. ESM createRequire from import.meta.url
    (name: string) => {
      try {
        const cr = createRequire(import.meta.url);
        return cr(name);
      } catch {
        return null;
      }
    },
    // 3. createRequire from process.cwd() package.json with normalized path for Windows
    (name: string) => {
      try {
        const pkgPath = path.resolve(process.cwd(), 'package.json');
        const cr = createRequire(pkgPath);
        return cr(name);
      } catch {
        return null;
      }
    },
    // 4. Webpack __non_webpack_require__
    (name: string) => {
      if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(name);
      }
      return null;
    },
    // 5. Global require
    (name: string) => {
      if (typeof require !== 'undefined') {
        return require(name);
      }
      return null;
    },
    // 6. Eval require (escapes bundlers)
    (name: string) => {
      try {
        const req = eval('require');
        return req(name);
      } catch {
        return null;
      }
    }
  ];

  for (const hook of requireHooks) {
    for (const name of candidateNames) {
      try {
        const mod = hook(name);
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

  const requireHooks: ((name: string) => any)[] = [
    (name: string) => {
      if (typeof import.meta !== 'undefined' && typeof (import.meta as any).require === 'function') {
        return (import.meta as any).require(name);
      }
      return null;
    },
    (name: string) => {
      try {
        const cr = createRequire(import.meta.url);
        return cr(name);
      } catch {
        return null;
      }
    },
    (name: string) => {
      try {
        const pkgPath = path.resolve(process.cwd(), 'package.json');
        const cr = createRequire(pkgPath);
        return cr(name);
      } catch {
        return null;
      }
    },
    (name: string) => {
      if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(name);
      }
      return null;
    },
    (name: string) => {
      if (typeof require !== 'undefined') {
        return require(name);
      }
      return null;
    },
    (name: string) => {
      try {
        const req = eval('require');
        return req(name);
      } catch {
        return null;
      }
    }
  ];

  for (const hook of requireHooks) {
    for (const name of candidateNames) {
      try {
        const mod = hook(name);
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
