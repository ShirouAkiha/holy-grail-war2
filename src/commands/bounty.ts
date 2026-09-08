import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  MessageFlags 
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { getOrInitWarSession, getReputationInfo } from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('bounties')
  .setDescription('🎯 Holy Church Extermination Bounty Registry — View wanted Rogue Heretic Masters');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const war = getOrInitWarSession(master);

    const participants = Object.values(war.participants || {});
    const rogueMasters = participants.filter(
      p => p.isAlive && (((p.innocentKills || 0) >= 10) || p.bountyActive || p.isRogueHeretic)
    );

    const userParticipant = war.participants[interaction.user.id];
    const userKills = userParticipant ? (userParticipant.innocentKills || 0) : (master.innocentKills || 0);
    const userRep = getReputationInfo(userKills);

    let bountyListText = '';
    if (rogueMasters.length === 0) {
      bountyListText = '🕊️ **No Active Church Extermination Bounties.**\nAll active Masters are currently abiding by the Secrecy of Magecraft or haven\'t reached 10 civilian casualties.';
    } else {
      bountyListText = rogueMasters.map((r, idx) => {
        return `**${idx + 1}. ☠️ Master ${r.username}** (${r.servantName || 'Unknown Servant'} [${r.servantClass || 'Class Concealed'}])\n` +
          `   • **Civilian Casualties:** \`${r.innocentKills || 10} Kills\` (Excommunicated)\n` +
          `   • 🎯 **Bounty Reward:** **+1 Extra Command Seal** 💠 & **+15 Saint Quartz** 💎\n` +
          `   • **Status:** Permanently Barred from Church Sanctuary • Curse of Heresy Active`;
      }).join('\n\n');
    }

    const embed = new EmbedBuilder()
      .setTitle('🎯 Holy Church Extermination Bounty Registry')
      .setDescription(
        `*Father Kirei Kotomine maintains this public bounty ledger at the Fuyuki Church altar.*\n\n` +
        `📜 **CHURCH EXTERMINATION BOUNTY PROTOCOL:**\n` +
        `• Any Master who slays **10+ innocent bystanders** is declared a **Rogue Heretic**.\n` +
        `• An open **+1 Command Seal & +15 Saint Quartz** bounty is placed on their head.\n` +
        `• Defeating or executing a wanted Rogue Heretic in battle or duel immediately awards the bounty to the victor!\n\n` +
        `🎯 **CURRENT WANTED LIST (${rogueMasters.length} Active):**\n` +
        bountyListText + '\n\n' +
        `👤 **YOUR CHURCH STANDING:**\n` +
        `• Rank: **${userRep.badge}** (${userKills}/10 Civilian Kills)\n` +
        `• Status: ${userRep.isRogue ? '☠️ **WANTED ROGUE HERETIC (BOUNTY ON YOUR HEAD)**' : '🕊️ **Good Standing with Holy Church**'}`
      )
      .setColor(rogueMasters.length > 0 ? 0xef4444 : 0xd4af37)
      .setFooter({ text: 'Holy Church Inquisitorial Office • Father Kirei Kotomine' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('war_tab_church')
        .setLabel('Church Sanctuary ⛪')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('war_tab_board')
        .setLabel('War Board 📋')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  } catch (error: any) {
    console.error('Error in /bounties:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error viewing bounties: ${error.message}` });
    }
  }
}
