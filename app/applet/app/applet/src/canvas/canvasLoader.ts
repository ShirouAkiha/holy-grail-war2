import fs from 'fs';
import path from 'path';

declare const __non_webpack_require__: any;

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

function tryLoadNativeCanvas(): any {
  const req = getRuntimeRequire();
  if (!req) return null;

  const names = [
    '@napi-rs/canvas',
    '@napi-rs/canvas-win32-x64-msvc',
    '@napi-rs/canvas-win32-ia32-msvc',
    '@napi-rs/canvas-win32-arm64-msvc',
    '@napi-rs/canvas-linux-x64-gnu',
    '@napi-rs/canvas-darwin-x64',
    '@napi-rs/canvas-darwin-arm64',
    'canvas',
    'skia-canvas'
  ];

  for (const name of names) {
    try {
      const mod = req(name);
      if (mod && (typeof mod.createCanvas === 'function' || typeof mod.default?.createCanvas === 'function')) {
        return mod.createCanvas ? mod : mod.default;
      }
    } catch {
      // Continue searching
    }
  }

  // Attempt process.dlopen on .node files if present in node_modules
  try {
    const nmDir = path.resolve(process.cwd(), 'node_modules');
    if (fs.existsSync(nmDir)) {
      const candidates = [
        path.join(nmDir, '@napi-rs', 'canvas-win32-x64-msvc', 'canvas.win32-x64-msvc.node'),
        path.join(nmDir, '@napi-rs', 'canvas', 'canvas.win32-x64-msvc.node'),
        path.join(nmDir, 'canvas', 'build', 'Release', 'canvas.node')
      ];
      for (const nodePath of candidates) {
        if (fs.existsSync(nodePath)) {
          const mod = { exports: {} };
          process.dlopen(mod as any, nodePath);
          if (mod.exports && typeof (mod.exports as any).createCanvas === 'function') {
            return mod.exports;
          }
        }
      }
    }
  } catch {
    // Ignore dlopen errors
  }

  return null;
}

class SVGGradient {
  id: string;
  type: 'linear' | 'radial';
  stops: Array<{ offset: number; color: string }> = [];
  x1 = 0; y1 = 0; x2 = 0; y2 = 100;

  constructor(type: 'linear' | 'radial', id: string, x1 = 0, y1 = 0, x2 = 0, y2 = 100) {
    this.type = type;
    this.id = id;
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
  }

  addColorStop(offset: number, color: string) {
    this.stops.push({ offset, color });
  }
}

function createFallbackCanvasModule(): any {
  class FallbackContext2D {
    canvas: FallbackCanvas;
    fillStyle: any = '#000000';
    strokeStyle: any = '#000000';
    lineWidth = 1;
    font = '10px sans-serif';
    textAlign: string = 'left';
    textBaseline: string = 'alphabetic';
    shadowColor = 'transparent';
    shadowBlur = 0;
    shadowOffsetX = 0;
    shadowOffsetY = 0;
    lineCap = 'butt';
    lineJoin = 'miter';

    private elements: string[] = [];
    private defs: string[] = [];
    private defCount = 0;
    private currentPath: string[] = [];
    private clipPathId: string | null = null;

    constructor(canvas: FallbackCanvas) {
      this.canvas = canvas;
    }

    save() {}
    restore() {}
    translate(x: number, y: number) {}
    scale(x: number, y: number) {}
    rotate(angle: number) {}

    beginPath() {
      this.currentPath = [];
    }

    closePath() {
      this.currentPath.push('Z');
    }

    moveTo(x: number, y: number) {
      this.currentPath.push(`M ${x} ${y}`);
    }

    lineTo(x: number, y: number) {
      this.currentPath.push(`L ${x} ${y}`);
    }

    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
      this.currentPath.push(`M ${x - radius} ${y} A ${radius} ${radius} 0 1 0 ${x + radius} ${y} A ${radius} ${radius} 0 1 0 ${x - radius} ${y}`);
    }

    ellipse(x: number, y: number, rx: number, ry: number, rotation: number, startAngle: number, endAngle: number) {
      this.currentPath.push(`M ${x - rx} ${y} A ${rx} ${ry} 0 1 0 ${x + rx} ${y} A ${rx} ${ry} 0 1 0 ${x - rx} ${y}`);
    }

    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      this.currentPath.push(`Q ${cpx} ${cpy} ${x} ${y}`);
    }

    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      this.currentPath.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`);
    }

    rect(x: number, y: number, w: number, h: number) {
      this.currentPath.push(`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`);
    }

    roundRect(x: number, y: number, w: number, h: number, r: number = 0) {
      this.rect(x, y, w, h);
    }

    fill() {
      if (this.currentPath.length > 0) {
        const fillAttr = this.getFillAttr();
        const clipAttr = this.clipPathId ? ` clip-path="url(#${this.clipPathId})"` : '';
        this.elements.push(`<path d="${this.currentPath.join(' ')}" ${fillAttr}${clipAttr}/>`);
      }
    }

    stroke() {
      if (this.currentPath.length > 0) {
        const strokeAttr = this.getStrokeAttr();
        const clipAttr = this.clipPathId ? ` clip-path="url(#${this.clipPathId})"` : '';
        this.elements.push(`<path d="${this.currentPath.join(' ')}" ${strokeAttr} fill="none"${clipAttr}/>`);
      }
    }

    clip() {
      if (this.currentPath.length > 0) {
        this.defCount++;
        const id = `clip_${this.defCount}`;
        this.defs.push(`<clipPath id="${id}"><path d="${this.currentPath.join(' ')}"/></clipPath>`);
        this.clipPathId = id;
      }
    }

    fillRect(x: number, y: number, w: number, h: number) {
      const fillAttr = this.getFillAttr();
      const clipAttr = this.clipPathId ? ` clip-path="url(#${this.clipPathId})"` : '';
      this.elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fillAttr}${clipAttr}/>`);
    }

    strokeRect(x: number, y: number, w: number, h: number) {
      const strokeAttr = this.getStrokeAttr();
      const clipAttr = this.clipPathId ? ` clip-path="url(#${this.clipPathId})"` : '';
      this.elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" ${strokeAttr}${clipAttr}/>`);
    }

    clearRect(x: number, y: number, w: number, h: number) {}

    fillText(text: string, x: number, y: number) {
      if (!text) return;
      const fillAttr = this.getFillAttr();
      const fontParts = this.parseFont();
      const anchor = this.textAlign === 'center' ? 'middle' : this.textAlign === 'right' ? 'end' : 'start';
      const clipAttr = this.clipPathId ? ` clip-path="url(#${this.clipPathId})"` : '';
      const escapedText = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      this.elements.push(`<text x="${x}" y="${y}" font-size="${fontParts.size}" font-family="${fontParts.family}" font-weight="${fontParts.weight}" text-anchor="${anchor}" ${fillAttr}${clipAttr}>${escapedText}</text>`);
    }

    measureText(text: string) {
      const parts = this.parseFont();
      const width = (text || '').length * (parts.size * 0.55);
      return { width, actualBoundingBoxAscent: parts.size, actualBoundingBoxDescent: parts.size * 0.2 };
    }

    drawImage(img: any, dx: number, dy: number, dw?: number, dh?: number) {
      if (!img) return;
      const width = dw || img.width || 100;
      const height = dh || img.height || 100;
      const clipAttr = this.clipPathId ? ` clip-path="url(#${this.clipPathId})"` : '';
      const src = typeof img === 'string' ? img : img.src || '';
      if (src) {
        this.elements.push(`<image href="${src}" x="${dx}" y="${dy}" width="${width}" height="${height}" preserveAspectRatio="none"${clipAttr}/>`);
      }
    }

    createLinearGradient(x1: number, y1: number, x2: number, y2: number) {
      this.defCount++;
      const id = `grad_${this.defCount}`;
      return new SVGGradient('linear', id, x1, y1, x2, y2);
    }

    createRadialGradient(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
      this.defCount++;
      const id = `grad_${this.defCount}`;
      return new SVGGradient('radial', id, x1, y1, x2, y2);
    }

    getImageData() {
      return { data: new Uint8ClampedArray(4) };
    }

    private getFillAttr(): string {
      if (this.fillStyle instanceof SVGGradient) {
        this.addGradientDef(this.fillStyle);
        return `fill="url(#${this.fillStyle.id})"`;
      }
      return `fill="${this.fillStyle || '#000000'}"`;
    }

    private getStrokeAttr(): string {
      let stroke = `stroke-width="${this.lineWidth}"`;
      if (this.strokeStyle instanceof SVGGradient) {
        this.addGradientDef(this.strokeStyle);
        stroke += ` stroke="url(#${this.strokeStyle.id})"`;
      } else {
        stroke += ` stroke="${this.strokeStyle || '#000000'}"`;
      }
      return stroke;
    }

    private addGradientDef(grad: SVGGradient) {
      const stopsSvg = grad.stops.map(s => `<stop offset="${(s.offset * 100)}%" stop-color="${s.color}"/>`).join('');
      if (grad.type === 'linear') {
        this.defs.push(`<linearGradient id="${grad.id}" x1="${grad.x1}" y1="${grad.y1}" x2="${grad.x2}" y2="${grad.y2}" gradientUnits="userSpaceOnUse">${stopsSvg}</linearGradient>`);
      } else {
        this.defs.push(`<radialGradient id="${grad.id}" cx="${grad.x1}" cy="${grad.y1}" r="${grad.x2}" gradientUnits="userSpaceOnUse">${stopsSvg}</radialGradient>`);
      }
    }

    private parseFont(): { size: number; family: string; weight: string } {
      const match = String(this.font).match(/(?:(bold|normal|\d+)\s+)?(\d+)px\s+(.+)/i);
      if (match) {
        return { weight: match[1] || 'normal', size: parseInt(match[2], 10), family: match[3] };
      }
      return { weight: 'normal', size: 14, family: 'sans-serif' };
    }

    toSVG(): string {
      const defsStr = this.defs.length > 0 ? `<defs>${this.defs.join('')}</defs>` : '';
      return `<svg width="${this.canvas.width}" height="${this.canvas.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${defsStr}${this.elements.join('')}</svg>`;
    }
  }

  class FallbackCanvas {
    width: number;
    height: number;
    private ctx: FallbackContext2D;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.ctx = new FallbackContext2D(this);
    }

    getContext(type: string) {
      return this.ctx;
    }

    toBuffer(type?: string): Buffer {
      const svg = this.ctx.toSVG();
      return Buffer.from(svg);
    }

    toDataURL(type?: string): string {
      const svg = this.ctx.toSVG();
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }
  }

  return {
    createCanvas: (w: number, h: number) => new FallbackCanvas(w, h),
    loadImage: async (src: any) => {
      return { src, width: 100, height: 100 };
    }
  };
}

export function getCanvasModule(): any {
  if (loadedCanvas) {
    return loadedCanvas;
  }

  const nativeMod = tryLoadNativeCanvas();
  if (nativeMod && typeof nativeMod.createCanvas === 'function') {
    loadedCanvas = nativeMod;
    return loadedCanvas;
  }

  loadedCanvas = createFallbackCanvasModule();
  return loadedCanvas;
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
        // Continue searching
      }
    }
  }

  return null;
}
