import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Supported MIME types
const MIME_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.json': 'application/json'
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const MEDIA_DIRS = [
  path.join(DATA_DIR, 'media'),
  path.join(DATA_DIR, 'media_cache'),
  path.join(process.cwd(), 'public', 'media'),
  path.join(process.cwd(), 'public', 'uploads'),
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    if (pathSegments.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // Sanitize filename/path to prevent directory traversal
    const requestedPath = pathSegments.join('/').replace(/\.\./g, '');
    const filename = path.basename(requestedPath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Find file in search directories
    let foundFilePath: string | null = null;

    for (const dir of MEDIA_DIRS) {
      const candidate = path.join(dir, requestedPath);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        foundFilePath = candidate;
        break;
      }
      // Also try direct filename match in dir
      const directCandidate = path.join(dir, filename);
      if (fs.existsSync(directCandidate) && fs.statSync(directCandidate).isFile()) {
        foundFilePath = directCandidate;
        break;
      }
    }

    if (!foundFilePath) {
      return NextResponse.json({ error: 'Media file not found' }, { status: 404 });
    }

    const stat = fs.statSync(foundFilePath);
    const fileBuffer = fs.readFileSync(foundFilePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: any) {
    console.error('[LocalMedia] Error serving media:', err);
    return NextResponse.json({ error: 'Failed to read media file' }, { status: 500 });
  }
}
