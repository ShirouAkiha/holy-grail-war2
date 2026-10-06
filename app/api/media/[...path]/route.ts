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

// Fallback remote source mapping for on-demand caching if file is missing
const REMOTE_SOURCES: Record<string, string> = {
  'ce_limited_zero_over.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/2/2b/CE33.webp/revision/latest?cb=20221009130120',
  'ce_volumen_hydragyrum.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/4/4b/CE185.webp/revision/latest?cb=20221009142635',
  'ce_origin_bullet.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/6/6d/CE263.webp/revision/latest?cb=20221013155833',
  'ce_imaginary_element.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/e/e1/CE28.webp/revision/latest?cb=20221009130003',
  'ce_gandr.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/8/87/CE24.webp/revision/latest?cb=20221009125901',
  'ce_projection.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/2/2b/CE23.webp/revision/latest?cb=20221009125846',
  'ce_verdant_sound.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/e/e7/CE25.webp/revision/latest?cb=20221009125917',
  'ce_code_cast.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/f/f7/CE56.webp/revision/latest?cb=20221009130848',
  'ce_when_the_flowers_fall.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/8/8c/CE2470.webp/revision/latest?cb=20251008124913',
  'ce_dragon_meridian.png': 'https://img.gamepress.gg/grandorder/FGOCEFull_9400180a.png?width=680',
  'ce_jeweled_sword.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/9/94/CE247.webp/revision/latest?cb=20221013151845',
  'ce_hydra_dagger.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/0/0f/CE333.webp/revision/latest?cb=20221112055519',
  'ce_star_of_artoria.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/5/54/CE83.webp/revision/latest?cb=20221009132850',
  'ce_bond_gilgamesh_archer.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/3/32/CE216.webp/revision/latest?cb=20221011124736',
  'ce_the_kings_law.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/3/32/CE216.webp/revision/latest?cb=20221011124736',
  'ce_bond_artoria_pendragon_alter.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/5/5a/CE195.webp/revision/latest?cb=20221011123634',
  'ce_bond_artoria_pendragon.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/1/10/CE191.webp/revision/latest?cb=20221011123600',
  'ce_bond_scathach_lancer.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/1/17/CE251.webp/revision/latest?cb=20221013154318',
  'ce_bond_jeanne_darc_ruler.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/c/c7/CE194.webp/revision/latest?cb=20221011123628',
  'ce_bond_jeanne_alter.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/f/fe/CE350.webp/revision/latest?cb=20221113095032',
  'ce_bond_mhx_alter.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/c/c0/CE429.webp/revision/latest?cb=20221209160900',
  'ce_bond_nero_claudius_saber.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/4/44/CE218.webp/revision/latest?cb=20221011124754',
  'ce_bond_emiya_archer.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/d/d5/CE196.webp/revision/latest?cb=20221011123649',
  'ce_bond_cu_chulainn_lancer.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/2/20/CE252.webp/revision/latest?cb=20221013154319',
  'ce_bond_karna_lancer.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/9/94/CE283.webp/revision/latest?cb=20221107152341',
  'ce_bond_aoko_aozaki.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/d/dd/CE2048.webp/revision/latest?cb=20240427051921',
  'ce_formal_craft.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/3/3a/CE31.webp/revision/latest?cb=20221009130050',
  'ce_fragment_2030.webp': 'https://static.wikia.nocookie.net/fategrandorder/images/0/07/CE67.webp/revision/latest?cb=20221009131815'
};

export const dynamic = 'force-dynamic';

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
      // Check if we can fetch on-demand from remote source
      const remoteUrl = REMOTE_SOURCES[filename];
      if (remoteUrl) {
        try {
          const res = await fetch(remoteUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://fategrandorder.fandom.com/'
            }
          });
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuf);
            // Cache on disk
            try {
              const saveDir = MEDIA_DIRS[0];
              fs.mkdirSync(saveDir, { recursive: true });
              fs.writeFileSync(path.join(saveDir, filename), fileBuffer);
              const pubDir = path.join(process.cwd(), 'public', 'media');
              fs.mkdirSync(pubDir, { recursive: true });
              fs.writeFileSync(path.join(pubDir, filename), fileBuffer);
            } catch (writeErr) {
              console.warn('[LocalMedia] Failed caching file to disk:', writeErr);
            }

            return new NextResponse(fileBuffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': fileBuffer.length.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
              }
            });
          }
        } catch (fetchErr) {
          console.error('[LocalMedia] On-demand remote fetch failed:', fetchErr);
        }
      }
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
