import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits 
} from 'discord.js';
import { addSaintQuartzToUser } from '../database/service';

// ==========================================
// SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('addsq')
  .setDescription('Admin: Grant or adjust Saint Quartz and Summon Tickets for any Master')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(opt =>
    opt
      .setName('user')
      .setDescription('The Master to grant Saint Quartz to')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt
      .setName('amount')
      .setDescription('Amount of Saint Quartz (SQ) to grant (e.g., 30, 100, 300). Use negative numbers to deduct.')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt
      .setName('tickets')
      .setDescription('Amount of Summon Tickets to grant (optional)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt
      .setName('reason')
      .setDescription('Reason for the grant (e.g. Maintenance Compensation, Event Reward)')
      .setRequired(false)
  );

// ==========================================
// COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  // Check Administrator Permissions
  const isGuildAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
                       interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (!isGuildAdmin) {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('⛔ Administrator Access Required')
          .setDescription('Only server administrators can grant Saint Quartz or Summon Tickets to Masters.')
          .setColor(0xef4444)
      ]
    });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const sqAmount = interaction.options.getInteger('amount', true);
  const ticketsAmount = interaction.options.getInteger('tickets') || 0;
  const reason = interaction.options.getString('reason') || 'Admin Grant';

  try {
    const result = await addSaintQuartzToUser(
      targetUser.id,
      sqAmount,
      ticketsAmount,
      targetUser.username
    );

    const isAddition = sqAmount >= 0;
    const sqSign = isAddition ? '+' : '';
    const ticketSign = ticketsAmount >= 0 ? '+' : '';

    const embed = new EmbedBuilder()
      .setTitle(`💎 CHALDEA TREASURY GRANT: ${targetUser.username}`)
      .setDescription(
        `**Saint Quartz & Ticket Balance Updated!**\n\n` +
        `👤 **Master:** <@${targetUser.id}> (\`${targetUser.username}\`)\n` +
        `💎 **Saint Quartz Adjustment:** \`${sqSign}${sqAmount.toLocaleString()} SQ\`\n` +
        (ticketsAmount !== 0 ? `🎫 **Summon Tickets Adjustment:** \`${ticketSign}${ticketsAmount.toLocaleString()} Ticket(s)\`\n` : '') +
        `📝 **Reason:** *${reason}*\n\n` +
        `📊 **New Total Balance:**\n` +
        `• **Saint Quartz:** 💎 \`${result.newSq.toLocaleString()} SQ\` (Was: ${result.previousSq.toLocaleString()} SQ)\n` +
        `• **Summon Tickets:** 🎫 \`${result.newTickets.toLocaleString()}\` (Was: ${result.previousTickets.toLocaleString()})`
      )
      .setColor(isAddition ? 0x38bdf8 : 0xf59e0b)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `Granted by Admin ${interaction.user.username} • Holy Grail War Protocol` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err: any) {
    console.error('Error executing /addsq:', err);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Grant Failed')
          .setDescription(`An error occurred while attempting to grant resources: ${err?.message || 'Unknown error'}`)
          .setColor(0xef4444)
      ]
    });
  }
}
