import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { claimDailySaintQuartz } from '../database/service';

// ==========================================
// SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily Master allowance of 30 Saint Quartz (SQ)');

// ==========================================
// EMBED BUILDERS & HELPERS
// ==========================================
export function buildDailyEmbed(
  user: { id: string; username: string; displayAvatarURL?: (opts?: any) => string },
  result: Awaited<ReturnType<typeof claimDailySaintQuartz>>
): EmbedBuilder {
  const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ size: 256 }) : undefined;

  if (result.success) {
    const nextClaimTime = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
    return new EmbedBuilder()
      .setTitle('💎 DAILY LEYLINE HARVEST: +30 SAINT QUARTZ CLAIMED!')
      .setDescription(
        `**Chaldea Daily Master Allowance Received!**\n\n` +
        `👤 **Master:** <@${user.id}> (\`${user.username}\`)\n` +
        `💎 **Harvested:** \`+30 Saint Quartz\` *(Full 10x Pull Value)*\n` +
        `📊 **New Total Balance:** 💎 \`${result.newTotalSq.toLocaleString()} SQ\` (Previous: ${result.previousSq.toLocaleString()} SQ)\n\n` +
        `⏳ **Next Daily Claim:** Available in **24 Hours** (<t:${nextClaimTime}:R>)\n\n` +
        `*Tip: You now have enough Saint Quartz to perform a 10x Craft Essence banner roll with \`/cegacha\`!*`
      )
      .setColor(0x38bdf8)
      .setThumbnail(avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400')
      .setFooter({ text: 'Holy Grail War Daily Allowance • Leyline Sanctuary Protocol' })
      .setTimestamp();
  }

  const nextTs = result.nextClaimTimestamp ? Math.floor(result.nextClaimTimestamp / 1000) : Math.floor((Date.now() + (result.cooldownRemainingMs || 0)) / 1000);
  return new EmbedBuilder()
    .setTitle('⏳ DAILY HARVEST ON COOLDOWN')
    .setDescription(
      `**You have already claimed your daily 30 Saint Quartz today.**\n\n` +
      `👤 **Master:** <@${user.id}> (\`${user.username}\`)\n` +
      `💎 **Current Balance:** 💎 \`${result.newTotalSq.toLocaleString()} SQ\`\n\n` +
      `⏱️ **Time Remaining:** \`${result.formattedCooldown || 'A few hours'}\`\n` +
      `🔮 **Next Reset:** <t:${nextTs}:R> (<t:${nextTs}:t>)\n\n` +
      `*The Fuyuki Leyline mana reservoirs recharge once every 24 hours. Check back tomorrow!*`
    )
    .setColor(0xf59e0b)
    .setThumbnail(avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400')
    .setFooter({ text: '24-Hour Leyline Cooldown Active' })
    .setTimestamp();
}

export function buildDailyButtons(result: Awaited<ReturnType<typeof claimDailySaintQuartz>>): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  
  if (result.success) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('quick_ce_gacha_ten')
        .setLabel('Spend in 10x Gacha (30 SQ)')
        .setEmoji('💎')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('quick_profile_view')
        .setLabel('View Master Profile')
        .setEmoji('👤')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('quick_profile_view')
        .setLabel('View Master Profile')
        .setEmoji('👤')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('quick_ce_gacha_view')
        .setLabel('View Gacha Banner')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return row;
}

// ==========================================
// COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const result = await claimDailySaintQuartz(interaction.user.id, interaction.user.username);
    const embed = buildDailyEmbed(interaction.user, result);
    const buttons = buildDailyButtons(result);

    await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });
  } catch (err: any) {
    console.error('Error executing /daily command:', err);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Claim Failed')
          .setDescription(`An unexpected error occurred while claiming your daily Saint Quartz: ${err?.message || 'Unknown error'}`)
          .setColor(0xef4444)
      ]
    });
  }
}
