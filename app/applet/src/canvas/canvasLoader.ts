import { createRequire } from 'module';

let loadedCanvas: any = null;

export function getCanvasModule(): any {
  if (loadedCanvas && typeof loadedCanvas.createCanvas === 'function') {
    return loadedCanvas;
  }

  const loaders = [
    () => {
      const cr = createRequire(process.cwd() + '/package.json');
      return cr('@napi-rs/canvas');
    },
    () => (typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__('@napi-rs/canvas') : null),
    () => (typeof require !== 'undefined' ? require('@napi-rs/canvas') : null),
    () => {
      const r = eval('require');
      return r('@napi-rs/canvas');
    }
  ];

  for (const loader of loaders) {
    try {
      const mod = loader();
      if (mod && typeof mod.createCanvas === 'function') {
        loadedCanvas = mod;
        return loadedCanvas;
      }
    } catch {
      // Try next loader
    }
  }

  console.error('❌ CRITICAL: Failed to load @napi-rs/canvas native module via all loaders.');
  return null;
}

let loadedGifenc: any = null;
export function getGifencModule(): any {
  if (loadedGifenc) return loadedGifenc;

  const loaders = [
    () => {
      const cr = createRequire(process.cwd() + '/package.json');
      return cr('gifenc');
    },
    () => (typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__('gifenc') : null),
    () => (typeof require !== 'undefined' ? require('gifenc') : null),
    () => {
      const r = eval('require');
      return r('gifenc');
    }
  ];

  for (const loader of loaders) {
    try {
      const mod = loader();
      if (mod) {
        loadedGifenc = mod;
        return loadedGifenc;
      }
    } catch {
      // Try next loader
    }
  }
  return null;
}
