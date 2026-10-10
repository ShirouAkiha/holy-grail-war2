import { NextRequest, NextResponse } from 'next/server';
import {
  getAllServantSpriteConfigs,
  setServantSpriteConfig,
  resetServantSpriteConfig,
  saveSpriteConfigsToDisk,
  DEFAULT_SERVANT_SPRITE_CONFIGS
} from '@/src/utils/spriteConfig';
import type { ServantSpriteConfig } from '@/src/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configs = getAllServantSpriteConfigs();
    return NextResponse.json({ success: true, configs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, config, servantId, configs } = body;

    if (action === 'set' && config) {
      const saved = setServantSpriteConfig(config as ServantSpriteConfig);
      return NextResponse.json({ success: true, config: saved });
    }

    if (action === 'reset' && servantId) {
      const reset = resetServantSpriteConfig(servantId);
      return NextResponse.json({ success: true, config: reset });
    }

    if (action === 'reset_all') {
      saveSpriteConfigsToDisk(DEFAULT_SERVANT_SPRITE_CONFIGS);
      return NextResponse.json({ success: true, configs: Object.values(DEFAULT_SERVANT_SPRITE_CONFIGS) });
    }

    if (action === 'save_all' && Array.isArray(configs)) {
      saveSpriteConfigsToDisk(configs);
      return NextResponse.json({ success: true, count: configs.length });
    }

    return NextResponse.json({ success: false, error: 'Invalid action or payload' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
