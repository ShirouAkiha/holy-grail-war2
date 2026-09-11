/**
 * Fate Holy Grail War - Complete Local Media Migration Engine
 * Downloads all remote media (Noble Phantasm animations, servant card art, avatars, craft essences)
 * and stores them permanently in local data/media/ and public/media/ so the entire game runs offline-ready.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const PUBLIC_MEDIA_DIR = path.join(process.cwd(), 'public', 'media');
const MANIFEST_FILE = path.join(DATA_DIR, 'media_manifest.json');

// Reliable fallbacks for canon servants in case any third-party link is unavailable
const KNOWN_NP_FALLBACKS = {
  'cu_chulainn_lancer': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'cu_chulainn': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'artoria_pendragon_alter': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'saber_alter': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'artoria_pendragon': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'gilgamesh_archer': 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
  'gilgamesh': 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
  'emiya_archer': 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
  'emiya': 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
  'jeanne_alter': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'jeanne_darc_ruler': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'scathach_lancer': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'scathach': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'nero_claudius_saber': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'nero_claudius': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'heracles_berserker': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'heracles': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'mhx_alter': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'karna_lancer': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'karna': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif'
};

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(PUBLIC_MEDIA_DIR)) fs.mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true });
}

async function fetchBuffer(url, timeoutMs = 15000, maxRedirects = 5) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const referer = url.includes('wikia.nocookie.net')
      ? 'https://fategrandorder.fandom.com/'
      : url.includes('blogger.googleusercontent.com')
        ? 'https://www.google.com/'
        : new URL(url).origin + '/';

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
        'Referer': referer,
        'Connection': 'keep-alive'
      }
    });

    clearTimeout(timer);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 0) {
        return { buffer, contentType };
      }
    }
  } catch (err) {}

  // Fallback to https.get
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Referer': parsedUrl.origin + '/'
          },
          timeout: timeoutMs
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
            const redirectUrl = new URL(res.headers.location, url).toString();
            return resolve(fetchBuffer(redirectUrl, timeoutMs, maxRedirects - 1));
          }

          if (res.statusCode !== 200) {
            return resolve(null);
          }

          const chunks = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || '';
            resolve(buffer.length > 0 ? { buffer, contentType } : null);
          });
          res.on('error', () => resolve(null));
        }
      );

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

function deduceExtension(url, contentType) {
  if (contentType) {
    if (contentType.includes('gif')) return '.gif';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('mp4')) return '.mp4';
    if (contentType.includes('webm')) return '.webm';
    if (contentType.includes('svg')) return '.svg';
  }
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (['.gif', '.webp', '.png', '.jpg', '.jpeg', '.mp4', '.webm', '.svg'].includes(ext)) {
      return ext;
    }
  } catch {}
  return '.gif';
}

async function downloadSingleMedia(url, baseName, servantKey = '') {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('/api/media/') || url.startsWith('/media/')) {
    return url; // Already local
  }

  ensureDirs();
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

  // Check if we already have a local file for this safeBase with any known extension
  const knownExts = ['.gif', '.webp', '.png', '.jpg', '.jpeg', '.mp4', '.webm'];
  for (const ext of knownExts) {
    const existing = path.join(MEDIA_DIR, `${safeBase}${ext}`);
    if (fs.existsSync(existing) && fs.statSync(existing).size > 100) {
      try {
        fs.copyFileSync(existing, path.join(PUBLIC_MEDIA_DIR, `${safeBase}${ext}`));
      } catch {}
      return `/api/media/${safeBase}${ext}`;
    }
  }

  let result = await fetchBuffer(url);

  // If failed (e.g. 404 on expired Discord link), try known fallback
  if (!result && servantKey && KNOWN_NP_FALLBACKS[servantKey]) {
    const fallbackUrl = KNOWN_NP_FALLBACKS[servantKey];
    console.warn(`[MediaDownloader] Original link failed for ${safeBase}. Using reliable fallback: ${fallbackUrl}`);
    result = await fetchBuffer(fallbackUrl);
  }

  if (!result || !result.buffer || result.buffer.length === 0) {
    console.error(`[MediaDownloader] FAILED to download ${safeBase} (url: ${url})`);
    return null;
  }

  const ext = deduceExtension(url, result.contentType);
  const filename = `${safeBase}${ext}`;
  const targetDataPath = path.join(MEDIA_DIR, filename);
  const targetPublicPath = path.join(PUBLIC_MEDIA_DIR, filename);

  fs.writeFileSync(targetDataPath, result.buffer);
  try {
    fs.writeFileSync(targetPublicPath, result.buffer);
  } catch {}

  const sizeKb = (result.buffer.length / 1024).toFixed(1);
  console.log(`[MediaDownloader] -> Saved local media: ${filename} (${sizeKb} KB)`);

  return `/api/media/${filename}`;
}

async function runMediaMigration() {
  ensureDirs();
  console.log('\n================================================================');
  console.log('       FATE HOLY GRAIL WAR - COMPLETE LOCAL MEDIA MIGRATION     ');
  console.log('================================================================\n');

  let totalDownloaded = 0;
  let totalFailed = 0;
  const manifest = {};

  // 1. Process Noble Phantasm Animations in data/servant_np_anims.json
  const npAnimsFile = path.join(DATA_DIR, 'servant_np_anims.json');
  if (fs.existsSync(npAnimsFile)) {
    console.log('--- 1. Processing Noble Phantasm Animations ---');
    try {
      const npAnims = JSON.parse(fs.readFileSync(npAnimsFile, 'utf-8'));
      if (Array.isArray(npAnims)) {
        for (const item of npAnims) {
          if (item && item.gifUrl) {
            const safeName = `np_${item.servantId || item.servantName}`;
            const localUrl = await downloadSingleMedia(item.gifUrl, safeName, item.servantId);
            if (localUrl) {
              item.originalUrl = item.originalUrl || item.gifUrl;
              item.gifUrl = localUrl;
              manifest[safeName] = { localUrl, originalUrl: item.originalUrl, servant: item.servantName };
              totalDownloaded++;
            } else {
              totalFailed++;
            }
          }
        }
        fs.writeFileSync(npAnimsFile, JSON.stringify(npAnims, null, 2), 'utf-8');
        console.log(`[NP Animations] Synchronized ${npAnims.length} animations to local storage.`);
      }
    } catch (err) {
      console.error('Error processing servant_np_anims.json:', err);
    }
  }

  // 2. Process Canon Servants in src/data/servants.ts
  console.log('\n--- 2. Processing Canon Servants Artwork & Avatars ---');
  const servantsTsFile = path.join(process.cwd(), 'src', 'data', 'servants.ts');
  if (fs.existsSync(servantsTsFile)) {
    try {
      let tsContent = fs.readFileSync(servantsTsFile, 'utf-8');
      const urlMatches = tsContent.match(/https?:\/\/[^\s'\",]+/g) || [];
      const uniqueUrls = [...new Set(urlMatches)];

      for (const remoteUrl of uniqueUrls) {
        if (remoteUrl.includes('ella.janitorai.com') || remoteUrl.includes('unsplash.com')) {
          const hashOrName = path.basename(new URL(remoteUrl).pathname).replace(/\.[^.]+$/, '');
          const localUrl = await downloadSingleMedia(remoteUrl, `servant_art_${hashOrName}`);
          if (localUrl) {
            tsContent = tsContent.split(remoteUrl).join(localUrl);
            totalDownloaded++;
          }
        }
      }
      fs.writeFileSync(servantsTsFile, tsContent, 'utf-8');
      console.log('[Canon Servants] Updated src/data/servants.ts to reference local media paths.');
    } catch (err) {
      console.error('Error processing src/data/servants.ts:', err);
    }
  }

  // 3. Process Custom Servants in data/custom_servants.json
  const customServantsFile = path.join(DATA_DIR, 'custom_servants.json');
  if (fs.existsSync(customServantsFile)) {
    console.log('\n--- 3. Processing Custom Servants ---');
    try {
      const customServants = JSON.parse(fs.readFileSync(customServantsFile, 'utf-8'));
      if (Array.isArray(customServants)) {
        for (const s of customServants) {
          if (s.avatarUrl && !s.avatarUrl.startsWith('/api/media/')) {
            const localAvatar = await downloadSingleMedia(s.avatarUrl, `avatar_${s.id || s.name}`, s.id);
            if (localAvatar) s.avatarUrl = localAvatar;
          }
          if (s.cardArtUrl && !s.cardArtUrl.startsWith('/api/media/')) {
            const localArt = await downloadSingleMedia(s.cardArtUrl, `cardart_${s.id || s.name}`, s.id);
            if (localArt) s.cardArtUrl = localArt;
          }
          if (s.noblePhantasm) {
            if (s.noblePhantasm.animationUrl && !s.noblePhantasm.animationUrl.startsWith('/api/media/')) {
              const localNp = await downloadSingleMedia(s.noblePhantasm.animationUrl, `np_${s.id || s.name}`, s.id);
              if (localNp) s.noblePhantasm.animationUrl = localNp;
            }
            if (s.noblePhantasm.gifUrl && !s.noblePhantasm.gifUrl.startsWith('/api/media/')) {
              const localNp = await downloadSingleMedia(s.noblePhantasm.gifUrl, `np_${s.id || s.name}`, s.id);
              if (localNp) s.noblePhantasm.gifUrl = localNp;
            }
          }
          totalDownloaded++;
        }
        fs.writeFileSync(customServantsFile, JSON.stringify(customServants, null, 2), 'utf-8');
        console.log(`[Custom Servants] Updated entries in data/custom_servants.json.`);
      }
    } catch (err) {
      console.error('Error processing custom_servants.json:', err);
    }
  }

  // 4. Process Craft Essences in src/data/craftEssences.ts
  console.log('\n--- 4. Processing Craft Essences Artwork ---');
  const cesTsFile = path.join(process.cwd(), 'src', 'data', 'craftEssences.ts');
  if (fs.existsSync(cesTsFile)) {
    try {
      let cesContent = fs.readFileSync(cesTsFile, 'utf-8');
      const urlMatches = cesContent.match(/https?:\/\/[^\s'\",]+/g) || [];
      const uniqueUrls = [...new Set(urlMatches)];

      for (const remoteUrl of uniqueUrls) {
        if (remoteUrl.includes('unsplash.com')) {
          const hash = path.basename(new URL(remoteUrl).pathname).substring(0, 15);
          const localUrl = await downloadSingleMedia(remoteUrl, `ce_art_${hash}`);
          if (localUrl) {
            cesContent = cesContent.split(remoteUrl).join(localUrl);
            totalDownloaded++;
          }
        }
      }
      fs.writeFileSync(cesTsFile, cesContent, 'utf-8');
      console.log('[Craft Essences] Updated src/data/craftEssences.ts to reference local media paths.');
    } catch (err) {
      console.error('Error processing craftEssences.ts:', err);
    }
  }

  // 5. Process Custom Craft Essences in data/custom_ces.json
  const customCesFile = path.join(DATA_DIR, 'custom_ces.json');
  if (fs.existsSync(customCesFile)) {
    console.log('\n--- 5. Processing Custom Craft Essences ---');
    try {
      const customCes = JSON.parse(fs.readFileSync(customCesFile, 'utf-8'));
      if (Array.isArray(customCes)) {
        for (const ce of customCes) {
          if (ce.artworkUrl && !ce.artworkUrl.startsWith('/api/media/')) {
            const localCe = await downloadSingleMedia(ce.artworkUrl, `ce_${ce.id || ce.name}`, ce.id);
            if (localCe) ce.artworkUrl = localCe;
          }
          totalDownloaded++;
        }
        fs.writeFileSync(customCesFile, JSON.stringify(customCes, null, 2), 'utf-8');
        console.log(`[Custom CEs] Updated entries in data/custom_ces.json.`);
      }
    } catch (err) {
      console.error('Error processing custom_ces.json:', err);
    }
  }

  // 6. Process Gacha Banner in data/gacha_banner.json
  const bannerFile = path.join(DATA_DIR, 'gacha_banner.json');
  if (fs.existsSync(bannerFile)) {
    console.log('\n--- 6. Processing Gacha Banner ---');
    try {
      const banner = JSON.parse(fs.readFileSync(bannerFile, 'utf-8'));
      if (banner && banner.bannerArtUrl && !banner.bannerArtUrl.startsWith('/api/media/')) {
        const localBanner = await downloadSingleMedia(banner.bannerArtUrl, `banner_${banner.id || 'current'}`);
        if (localBanner) {
          banner.bannerArtUrl = localBanner;
          fs.writeFileSync(bannerFile, JSON.stringify(banner, null, 2), 'utf-8');
          console.log(`[Gacha Banner] Updated banner artwork to local storage.`);
        }
      }
    } catch (err) {
      console.error('Error processing gacha_banner.json:', err);
    }
  }

  // 7. Synchronize Masters store
  const mastersFile = path.join(DATA_DIR, 'masters.json');
  if (fs.existsSync(mastersFile)) {
    console.log('\n--- 7. Synchronizing Masters Servant Instances ---');
    try {
      const masters = JSON.parse(fs.readFileSync(mastersFile, 'utf-8'));
      let modified = false;
      if (Array.isArray(masters)) {
        for (const master of masters) {
          if (master.servants && Array.isArray(master.servants)) {
            for (const inst of master.servants) {
              const tmplId = inst.templateId || (inst.template && inst.template.id);
              const safeNpKey = `np_${tmplId}`;
              if (manifest[safeNpKey]) {
                if (inst.template && inst.template.noblePhantasm) {
                  inst.template.noblePhantasm.animationUrl = manifest[safeNpKey].localUrl;
                  inst.template.noblePhantasm.gifUrl = manifest[safeNpKey].localUrl;
                  modified = true;
                }
              }
            }
          }
        }
        if (modified) {
          fs.writeFileSync(mastersFile, JSON.stringify(masters, null, 2), 'utf-8');
          console.log('[Masters] Synchronized Master servant instances to local media paths.');
        }
      }
    } catch (err) {
      console.error('Error processing masters.json:', err);
    }
  }

  // 8. Synchronize Active Holy Grail War Session
  const grailWarFile = path.join(DATA_DIR, 'grail_war.json');
  if (fs.existsSync(grailWarFile)) {
    console.log('\n--- 8. Synchronizing Holy Grail War Session ---');
    try {
      const war = JSON.parse(fs.readFileSync(grailWarFile, 'utf-8'));
      let warModified = false;
      if (war && war.participants) {
        for (const participant of Object.values(war.participants)) {
          if (participant.servant && participant.servant.template) {
            const tmplId = participant.servant.templateId || participant.servant.template.id;
            const safeNpKey = `np_${tmplId}`;
            if (manifest[safeNpKey] && participant.servant.template.noblePhantasm) {
              participant.servant.template.noblePhantasm.animationUrl = manifest[safeNpKey].localUrl;
              participant.servant.template.noblePhantasm.gifUrl = manifest[safeNpKey].localUrl;
              warModified = true;
            }
          }
        }
      }
      if (warModified) {
        fs.writeFileSync(grailWarFile, JSON.stringify(war, null, 2), 'utf-8');
        console.log('[Grail War] Synchronized active war session to local media paths.');
      }
    } catch (err) {
      console.error('Error processing grail_war.json:', err);
    }
  }

  // 9. Write Media Manifest
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');

  // Summary stats
  const localFiles = fs.readdirSync(MEDIA_DIR);
  let totalBytes = 0;
  for (const f of localFiles) {
    totalBytes += fs.statSync(path.join(MEDIA_DIR, f)).size;
  }
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  console.log('\n================================================================');
  console.log('             LOCAL MEDIA MIGRATION COMPLETE!                   ');
  console.log('================================================================');
  console.log(`Total Local Media Files in data/media: ${localFiles.length}`);
  console.log(`Total Storage Used:                   ${totalMb} MB`);
  console.log(`Manifest File:                        data/media_manifest.json`);
  console.log(`Served at API endpoints:              /api/media/[filename]`);
  console.log('================================================================\n');
}

runMediaMigration();
