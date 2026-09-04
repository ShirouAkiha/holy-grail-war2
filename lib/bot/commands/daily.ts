/**
 * Slash Command: /daily (and /claim)
 * Description: Claim daily Master allowance of 30 Saint Quartz (SQ) every 24 hours
 * Library: discord.js v14
 */

export const dailyCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { claimDailySaintQuartz } from '../database/service';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily Master allowance of 30 Saint Quartz (SQ)');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const result = await claimDailySaintQuartz(interaction.user.id, interaction.user.username);
    const avatarUrl = interaction.user.displayAvatarURL({ size: 256 });

    if (result.success) {
      const nextClaimTime = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
      const embed = new EmbedBuilder()
        .setTitle('💎 DAILY LEYLINE HARVEST: +30 SAINT QUARTZ CLAIMED!')
        .setDescription(
          \`**Chaldea Daily Master Allowance Received!**\\n\\n\` +
          \`👤 **Master:** <@\${interaction.user.id}> (\`\${interaction.user.username}\`)\\n\` +
          \`💎 **Harvested:** \`+30 Saint Quartz\` *(Full 10x Pull Value)*\\n\` +
          \`📊 **New Total Balance:** 💎 \`\${result.newTotalSq.toLocaleString()} SQ\` (Previous: \${result.previousSq.toLocaleString()} SQ)\\n\\n\` +
          \`⏳ **Next Daily Claim:** Available in **24 Hours** (<t:\${nextClaimTime}:R>)\\n\\n\` +
          \`*Tip: You now have enough Saint Quartz to perform a 10x Craft Essence banner roll with \`/cegacha\`!*\`
        )
        .setColor(0x38bdf8)
        .setThumbnail(avatarUrl)
        .setFooter({ text: 'Holy Grail War Daily Allowance • Leyline Sanctuary Protocol' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

      await interaction.reply({ embeds: [embed], components: [row] });
    } else {
      const nextTs = result.nextClaimTimestamp 
        ? Math.floor(result.nextClaimTimestamp / 1000) 
        : Math.floor((Date.now() + (result.cooldownRemainingMs || 0)) / 1000);

      const embed = new EmbedBuilder()
        .setTitle('⏳ DAILY HARVEST ON COOLDOWN')
        .setDescription(
          \`**You have already claimed your daily 30 Saint Quartz today.**\\n\\n\` +
          \`👤 **Master:** <@\${interaction.user.id}> (\`\${interaction.user.username}\`)\\n\` +
          \`💎 **Current Balance:** 💎 \`\${result.newTotalSq.toLocaleString()} SQ\`\\n\\n\` +
          \`⏱️ **Time Remaining:** \`\${result.formattedCooldown || 'A few hours'}\`\\n\` +
          \`🔮 **Next Reset:** <t:\${nextTs}:R> (<t:\${nextTs}:t>)\\n\\n\` +
          \`*The Fuyuki Leyline mana reservoirs recharge once every 24 hours. Check back tomorrow!*\`
        )
        .setColor(0xf59e0b)
        .setThumbnail(avatarUrl)
        .setFooter({ text: '24-Hour Leyline Cooldown Active' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  } catch (err: any) {
    console.error('Error executing /daily:', err);
    await interaction.reply({
      ephemeral: true,
      content: \`❌ Error processing daily claim: \${err.message}\`
    });
  }
}
`;
