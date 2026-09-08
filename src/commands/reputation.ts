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
  .setName('reputation')
  .setDescription('📜 Church Reputation Dossier — View your standing with Father Kotomine');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const war = getOrInitWarSession(master);

    const userParticipant = war.participants[interaction.user.id];
    const userKills = userParticipant ? (userParticipant.innocentKills || 0) : (master.innocentKills || 0);
    const rep = getReputationInfo(userKills);

    const embed = new EmbedBuilder()
      .setTitle('📜 Holy Church Reputation & Oversight Dossier')
      .setDescription(
        `*Overseer Father Kirei Kotomine observes all Masters participating in the Fuyuki Holy Grail War.*\n\n` +
        `👤 **MASTER STANDING: ${rep.badge}**\n` +
        `• **Civilian Casualties:** \`${userKills}/10 Kills\`\n` +
        `• **Overseer Assessment:** *"${rep.description}"*\n` +
        `• **Church Sanctuary Eligibility:** ${rep.isRogue ? '🚫 **REVOKED (Excommunicated)**' : '🕊️ **ELIGIBLE (Neutral Asylum Granted on request)**'}\n` +
        `• **Combat Modifier:** ${rep.isRogue ? '⛓️ **Curse of Heresy (-10% ATK)**' : '✨ **Standard Leyline Alignment**'}\n\n` +
        `⚖️ **REPUTATION RANKS OVERVIEW:**\n` +
        `• 🕊️ **Honorable Magus (0-3 Kills):** Full sanctuary rights & Overseer protection.\n` +
        `• ⚠️ **Suspect Magus (4-6 Kills):** Under surveillance for collateral damage.\n` +
        `• 🩸 **Notorious Magus (7-9 Kills):** High scrutiny. Impending excommunication.\n` +
        `• ☠️ **Rogue Heretic (10+ Kills):** +1 CS & +15 SQ Extermination Bounty, barred from church sanctuary, exposed on war map, -10% ATK.`
      )
      .setColor(rep.isRogue ? 0xef4444 : userKills >= 7 ? 0xf97316 : userKills >= 4 ? 0xeab308 : 0x10b981)
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
    console.error('Error in /reputation:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error viewing reputation: ${error.message}` });
    }
  }
}
