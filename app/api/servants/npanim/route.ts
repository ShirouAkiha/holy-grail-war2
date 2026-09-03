import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCustomNpAnimations,
  getServantNpAnimation,
  setServantNpAnimation,
  getDuelNpSettings,
  setDuelNpSettings,
  getAllThroneServants
} from '@/src/database/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const servantId = searchParams.get('servantId') || searchParams.get('servant');

    if (servantId) {
      const anim = getServantNpAnimation(servantId);
      return NextResponse.json({ success: true, animation: anim || null });
    }

    const animations = getAllCustomNpAnimations();
    const settings = getDuelNpSettings();
    return NextResponse.json({
      success: true,
      animations,
      settings
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, servant, gifUrl, chant, configuredBy, autoDelete, afkTimeoutSeconds } = body;

    if (action === 'set_settings') {
      const updated = setDuelNpSettings({
        autoDelete: typeof autoDelete === 'boolean' ? autoDelete : undefined,
        afkTimeoutSeconds: typeof afkTimeoutSeconds === 'number' ? afkTimeoutSeconds : undefined
      });
      return NextResponse.json({ success: true, settings: updated });
    }

    if (action === 'set_anim' || !action) {
      if (!servant || !gifUrl) {
        return NextResponse.json({ success: false, error: 'servant and gifUrl are required' }, { status: 400 });
      }

      const result = setServantNpAnimation(
        servant,
        gifUrl,
        chant || undefined,
        configuredBy || 'Admin Portal'
      );

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        servant: result.servant,
        animations: getAllCustomNpAnimations(),
        settings: getDuelNpSettings()
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
