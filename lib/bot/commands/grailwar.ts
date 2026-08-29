/**
 * Slash Command: /grailwar
 * Description: Holy Grail War 7-Master Tournament Battle Royale (AP, Scouting, Alliances, Betrayal)
 * Library: discord.js v14
 */

export const grailwarCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder 
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { 
  createHolyGrailWarSession, 
  executeWarAction, 
  advanceWarRound 
} from '../engine/grailwar';
import { DistrictId } from '../types';

export const data = new SlashCommandBuilder()
  .setName('grailwar')
  .setDescription('Enter or manage the 7-Master Holy Grail War Battle Royale')
  .addSubcommand(sub =>
    sub.setName('status').setDescription('View current Holy Grail War map, participants, and AP')
  )
  .addSubcommand(sub =>
    sub.setName('scout').setDescription('Scout your current district for enemy Servants (20 AP)')
  )
  .addSubcommand(sub =>
    sub.setName('fortify').setDescription('Claim control over the current Leyline focal point (25 AP)')
  )
  .addSubcommand(sub =>
    sub.setName('rest').setDescription('Rest and restore 45% HP + recover Command Seals at the Church (30 AP)')
  )
  .addSubcommand(sub =>
    sub.setName('betray').setDescription('Execute a surprise betrayal attack against your ally (20 AP)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

    if (!activeServant) {
      await interaction.editReply({
        content: '❌ You cannot enter the Holy Grail War without a contracted Servant! Use \`/summon\` first.'
      });
      return;
    }

    // In production, retrieve the guild active session from Prisma DB
    // Here we instantiate or retrieve the war session
    const war = createHolyGrailWarSession({
      discordId: interaction.user.id,
      username: interaction.user.username,
      servantId: activeServant.id,
      servantName: activeServant.template.name,
      avatarUrl: activeServant.template.avatarUrl,
      maxHp: activeServant.template.baseHp
    });

    const sub = interaction.options.getSubcommand();
    const p = war.participants[interaction.user.id];

    if (sub === 'status') {
      const aliveCount = Object.values(war.participants).filter(x => x.isAlive).length;
      const currentDistrict = war.districts[p.currentDistrict];

      const embed = new EmbedBuilder()
        .setTitle(\`🏆 \${war.title} — Round \${war.currentRound}/\${war.maxRounds}\`)
        .setDescription(
          \`⚡ **Your Action Points:** \${p.ap}/100 AP\\n\` +
          \`📍 **Current District:** \${currentDistrict.name}\\n\` +
          \`✨ **Leyline Effect:** \${currentDistrict.leylineBonus}\\n\` +
          \`🩸 **Command Seals:** \${p.commandSeals}/3\\n\` +
          \`👥 **Surviving Masters:** \${aliveCount}/7 alive\\n\\n\` +
          \`**District Participants:**\\n\` +
          Object.values(war.participants)
            .map(m => \`• \${m.isAlive ? '🟢' : '💀'} **\${m.username}** (\${m.servantName} - \${m.servantClass}) — *\${war.districts[m.currentDistrict].name}*\`)
            .join('\\n')
        )
        .setColor(0xf59e0b)
        .setFooter({ text: 'Use buttons below to move, scout, fortify, or ally' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('war_scout').setLabel('Scout District (20 AP)').setEmoji('🔭').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('war_fortify').setLabel('Fortify Leyline (25 AP)').setEmoji('🏰').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('war_rest').setLabel('Rest & Heal (30 AP)').setEmoji('🩹').setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    let actionType: 'scout' | 'fortify_leyline' | 'rest_and_heal' | 'betray_ally' = 'scout';
    if (sub === 'fortify') actionType = 'fortify_leyline';
    if (sub === 'rest') actionType = 'rest_and_heal';
    if (sub === 'betray') actionType = 'betray_ally';

    const result = executeWarAction(war, interaction.user.id, actionType);

    const resultEmbed = new EmbedBuilder()
      .setTitle(result.success ? '✅ Holy Grail War Action Completed' : '⚠️ Action Failed')
      .setDescription(
        \`\${result.message}\\n\\n\` +
        \`⚡ **Remaining AP:** \${result.updatedWar.participants[interaction.user.id]?.ap ?? 0} AP\`
      )
      .setColor(result.success ? 0x22c55e : 0xef4444);

    await interaction.editReply({ embeds: [resultEmbed] });

  } catch (error: any) {
    console.error('Error executing /grailwar:', error);
    await interaction.editReply({
      content: \`❌ Grail War system error: \${error.message}\`
    });
  }
}
`;
