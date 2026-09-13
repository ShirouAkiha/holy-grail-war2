import { NextRequest, NextResponse } from 'next/server';
import { getOrInitWarSession } from '@/src/engine/grailwar';
import { 
  generateKotomine24hHomily, 
  generateFuyuki2hNewsBulletin, 
  getOrInitChurchIntel 
} from '@/src/engine/churchNewsService';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true';
    const type = searchParams.get('type'); // 'homily' | 'news' | 'all'

    const war = getOrInitWarSession();

    if (type === 'homily') {
      const homily = await generateKotomine24hHomily(war, forceRefresh);
      return NextResponse.json({ success: true, homily });
    }

    if (type === 'news') {
      const news = await generateFuyuki2hNewsBulletin(war, forceRefresh);
      return NextResponse.json({ success: true, news });
    }

    // Default: fetch / ensure both
    const { homily, news } = await getOrInitChurchIntel(war);
    return NextResponse.json({
      success: true,
      homily,
      news,
      homilyHistory: war.homilyHistory || [],
      newsHistory: war.newsHistory || []
    });
  } catch (error: any) {
    console.error('Error in /api/grail/church:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve Church & News intelligence' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'refresh_all'; // 'refresh_homily' | 'refresh_news' | 'refresh_all'

    const war = getOrInitWarSession();

    if (action === 'refresh_homily') {
      const homily = await generateKotomine24hHomily(war, true);
      return NextResponse.json({ success: true, homily, message: 'Generated fresh 24-hour Kotomine Homily via Gemini' });
    }

    if (action === 'refresh_news') {
      const news = await generateFuyuki2hNewsBulletin(war, true);
      return NextResponse.json({ success: true, news, message: 'Broadcasted fresh 2-hour Fuyuki News Bulletin via Gemini' });
    }

    const [homily, news] = await Promise.all([
      generateKotomine24hHomily(war, true),
      generateFuyuki2hNewsBulletin(war, true)
    ]);

    return NextResponse.json({
      success: true,
      homily,
      news,
      message: 'Refreshed 24-Hour Kotomine Homily & 2-Hour Fuyuki News Bulletin via Gemini'
    });
  } catch (error: any) {
    console.error('Error in POST /api/grail/church:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to refresh Church intelligence' },
      { status: 500 }
    );
  }
}
