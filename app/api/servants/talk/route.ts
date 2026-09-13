import { NextRequest, NextResponse } from 'next/server';
import { generateServantTalkResponse, renderServantTalkVisualOutput, ServantTalkContext } from '@/src/engine/talkService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const context: ServantTalkContext = body.context;
    const renderCanvas = body.renderCanvas !== false;

    if (!context || !context.servantName || !context.playerMessage) {
      return NextResponse.json(
        { error: 'Invalid payload: servantName and playerMessage are required' },
        { status: 400 }
      );
    }

    // Generate dialogue string
    const { reply, source } = await generateServantTalkResponse(context);

    // STEP 3: Render the Output
    let visualOutput = null;
    if (renderCanvas) {
      visualOutput = await renderServantTalkVisualOutput({
        servantName: context.servantName,
        servantClass: context.servantClass,
        servantAvatarUrl: context.servantAvatarUrl,
        replyText: reply,
        playerMessage: context.playerMessage,
        masterName: context.masterName,
        bondLevel: context.bondLevel || 1,
        commandSeals: context.commandSeals ?? 3
      });
    }

    return NextResponse.json({
      success: true,
      reply,
      source,
      optionUsed: visualOutput?.optionUsed || 'Option B (Embed Fallback)',
      cardImageUrl: visualOutput?.cardImageBase64 || null,
      embedData: visualOutput?.embedData || {
        title: `💬 Telepathic Link | ${context.servantName} [${context.servantClass}]`,
        thumbnailUrl: context.servantAvatarUrl,
        description: `👤 **Master ${context.masterName}:**\n> *“${context.playerMessage}”*\n\n⚔️ **${context.servantName}:**\n> ❝ ***${reply}*** ❞\n\n*💖 Bond Rank: Lv. ${context.bondLevel || 1}/10 • 🔱 Command Seals: ${context.commandSeals ?? 3}/3*`,
        color: 0xd4af37,
        footer: `Bond Rank ${context.bondLevel || 1}/10 • Holy Grail War Telepathic Resonance`,
        bondRank: context.bondLevel || 1
      }
    });
  } catch (error: any) {
    console.error('Error in /api/servants/talk:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process Servant communication',
        reply: 'My spirit origin holds strong, Master. I stand by your side in this War.'
      },
      { status: 500 }
    );
  }
}
