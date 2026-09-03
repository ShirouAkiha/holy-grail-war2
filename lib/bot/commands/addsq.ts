/**
 * Admin Slash Command: /addsq
 * Description: Admin command to grant Saint Quartz (SQ) to Masters
 * Library: discord.js v14
 */

export const addsqCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits 
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';

export const data = new SlashCommandBuilder()
  .setName('addsq')
  .setDescription('Admin command to grant Saint Quartz (SQ) to Masters')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(opt =>
    opt.setName('master')
      .setDescription('Target Master to receive Saint Quartz')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt.setName('amount')
      .setDescription('Amount of Saint Quartz to grant (e.g. 30 for a 10x roll)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const targetUser = interaction.options.getUser('master', true);
    const amount = interaction.options.getInteger('amount', true);

    const master = await getOrCreateMaster(targetUser.id, targetUser.username);
    master.saintQuartz = (master.saintQuartz || 0) + amount;
    await saveMaster(master);

    const embed = new EmbedBuilder()
      .setTitle('💎 SAINT QUARTZ DISBURSED!')
      .setDescription(
        \`Granted **\${amount} Saint Quartz** to **\${targetUser.username}**!\\n\\n\` +
        \`💎 **New Master Balance:** **\${master.saintQuartz} Saint Quartz**\`
      )
      .setColor(0x06b6d4)
      .setFooter({ text: 'Admin Saint Quartz Ledger • Spend in /cegacha' });

    await interaction.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /addsq:', error);
    await interaction.reply({ content: \`❌ Error granting SQ: \${error.message}\`, ephemeral: true });
  }
}`;
