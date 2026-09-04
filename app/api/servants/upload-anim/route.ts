import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const servantId = (formData.get('servantId') as string) || 'servant';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Validate size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File size exceeds 25MB limit' }, { status: 400 });
    }

    // Determine extension and mime type
    const originalName = file.name || 'animation.gif';
    let ext = path.extname(originalName).toLowerCase();
    if (!ext) {
      if (file.type === 'image/gif') ext = '.gif';
      else if (file.type === 'video/mp4') ext = '.mp4';
      else if (file.type === 'video/webm') ext = '.webm';
      else if (file.type === 'image/webp') ext = '.webp';
      else if (file.type === 'image/png') ext = '.png';
      else ext = '.gif';
    }

    const safeServantName = servantId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const timestamp = Date.now();
    const filename = `np_${safeServantName}_${timestamp}${ext}`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const cacheDir = path.join(process.cwd(), 'data', 'media_cache');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    const cachePath = path.join(cacheDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    fs.writeFileSync(filePath, buffer);
    fs.writeFileSync(cachePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    let dataUrl = publicUrl;
    if (buffer.length <= 5 * 1024 * 1024) {
      const mime = file.type || (ext === '.gif' ? 'image/gif' : ext === '.png' ? 'image/png' : 'image/jpeg');
      dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    return NextResponse.json({
      success: true,
      url: dataUrl || publicUrl,
      publicUrl,
      dataUrl,
      filename,
      size: file.size,
      mimeType: file.type || 'image/gif'
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Upload failed' }, { status: 500 });
  }
}
