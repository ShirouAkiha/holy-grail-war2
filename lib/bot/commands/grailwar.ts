/**
 * Slash Command: /grailwar
 * Description: Holy Grail War 7-Master Tournament & Secret Intelligence Board
 * Library: discord.js v14
 */

export const grailwarCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { 
  createHolyGrailWarSession, 
  executeWarAction, 
  attackSuspectUserInWar,
  leakIntelInWar,
  exposeMasterInWar,
  simulateWarSkirmish 
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('grailwar')
  .setDescription('Holy Grail War Secret Intelligence Board & Battle Royale')
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('View the Holy Grail War Intelligence Board & Chronicle')
  )
  .addSubcommand(sub =>
    sub.setName('attack')
      .setDescription('Ambush a suspected Master in the server (if innocent, they die & you are exposed!)')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('The Master name or @mention of the suspected user')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('leak')
      .setDescription('Leak tactical intelligence or rumors onto the Grail War status board')
      .addStringOption(opt =>
        opt.setName('intel')
          .setDescription('The intelligence report or secret to broadcast')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('Optional: Master name or ID to expose with this leak')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('skirmish')
      .setDescription('Simulate a background clash between rival Masters in Fuyuki')
  )
  .addSubcommand(sub =>
    sub.setName('rest')
      .setDescription('Channel mana to restore Servant HP')
  )
  .addSubcommand(sub =>
    sub.setName('betray')
      .setDescription('Execute a surprise betrayal attack against your ally')
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

    // Retrieve or initialize active war session
    const war = createHolyGrailWarSession({
      discordId: interaction.user.id,
      username: interaction.user.username,
      servantId: activeServant.id,
      servantName: activeServant.template.name,
      avatarUrl: activeServant.template.avatarUrl,
      maxHp: activeServant.template.baseHp
    });

    const isPublicChannel = !interaction.channel?.isDMBased();
    // Rule: Public command invocation exposes the user if not already exposed
    if (isPublicChannel && !war.participants[interaction.user.id]?.isExposed) {
      exposeMasterInWar(war, interaction.user.id, 'public_command');
    }

    const sub = interaction.options.getSubcommand();
    const p = war.participants[interaction.user.id];

    if (sub === 'status') {
      const aliveCount = Object.values(war.participants).filter(x => x.isAlive).length;
      const exposedCount = Object.values(war.participants).filter(x => x.isExposed).length;
      const civilianDeaths = war.innocentVictims?.length || 0;
      const isUserExposed = p?.isExposed;

      // 1. Masters Roster Section (Masks unexposed shadow participants)
      const rosterLines = Object.values(war.participants).map((m, idx) => {
        const isUser = m.discordId === interaction.user.id;
        const statusIcon = !m.isAlive ? '💀' : m.isExposed ? '📡' : '🕶️';

        if (m.isExposed || isUser || !m.isAlive) {
          const hpBar = \`\${m.currentHp.toLocaleString()}/\${m.maxHp.toLocaleString()}\`;
          const exposureTag = m.exposureReason === 'public_command'
            ? '📡 [Exposed: Public Command]'
            : m.exposureReason === 'ambush_clash'
            ? '⚔️ [Exposed: Ambush Clash]'
            : m.exposureReason === 'innocent_assault'
            ? '☠️ [Exposed: Civilian Assault]'
            : m.exposureReason === 'intel_leak'
            ? '🕵️ [Exposed: Intel Leak]'
            : '⚔️ [Exposed: Open Combat]';

          return \`• \${statusIcon} **\${m.username}** \${isUser ? '**(YOU)**' : ''} — **\${m.servantName}** (\${m.servantClass}) — HP: \${hpBar} | Kills: \${m.kills}\\n  ↳ *\${!m.isAlive ? 'Eliminated from Tournament' : exposureTag}*\`;
        } else {
          return \`• \${statusIcon} **[Unknown Master #\${idx + 1} — In Shadows]** — Servant: **[CLASSIFIED]** (Class: Unknown) — HP: [CLASSIFIED] | Status: Concealed\`;
        }
      }).join('\\n\\n');

      // 2. War Chronicle & Recent Events Section (Lower part)
      const recentEvents = (war.eventLogs || []).slice(0, 6).map(evt => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return \`• [\${timeStr}] \${evt.text}\`;
      }).join('\\n');

      const chronicleSection = recentEvents || '• *No skirmishes or leaks recorded yet.*';

      const embed = new EmbedBuilder()
        .setTitle(\`🏆 \${war.title} — Intelligence Status Board\`)
        .setDescription(
          \`⚔️ **War Status:** \${war.status === 'concluded' ? '🏆 Concluded' : '🟢 ACTIVE BATTLE ROYALE'} | 🩸 **Seals:** \${p?.commandSeals ?? 3}/3\\n\` +
          \`👥 **Alive Masters:** \${aliveCount}/7 alive (\${exposedCount} Exposed, \${7 - exposedCount} in Shadows)\\n\` +
          \`☠️ **Civilian Casualties:** \${civilianDeaths} innocent bystanders slain\\n\` +
          \`👤 **Your Identity:** \${isUserExposed ? '📡 **EXPOSED TO SERVER**' : '🕶️ **CONCEALED IN SHADOWS**'}\\n\\n\` +
          \`📋 **7 Masters Roster (Intelligence Board):**\\n\` +
          rosterLines +
          \`\\n\\n📜 **War Chronicle & Recent Events (Skirmishes & Leaks):**\\n\` +
          chronicleSection
        )
        .setColor(0xf59e0b)
        .setFooter({ text: 'Use /grailwar attack @user to ambush | /grailwar leak to broadcast intel' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('war_attack_prompt').setLabel('Ambush Suspect (/grailwar attack)').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('war_leak_prompt').setLabel('Leak Intel (/grailwar leak)').setEmoji('🕵️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('war_rest').setLabel('Channel Mana (Heal)').setEmoji('🩹').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('war_skirmish').setLabel('Simulate City Skirmish').setEmoji('💥').setStyle(ButtonStyle.Primary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    if (sub === 'attack') {
      const targetQuery = interaction.options.getString('target', true);
      const res = attackSuspectUserInWar(war, interaction.user.id, targetQuery);

      const embed = new EmbedBuilder()
        .setTitle(res.targetWasMaster ? '⚔️ Holy Grail War: Tactical Ambush!' : '☠️ Collateral Casualty: Civilian Slain!')
        .setDescription(res.message)
        .setColor(res.targetWasMaster ? 0xef4444 : 0x7f1d1d)
        .setFooter({ text: res.targetWasMaster ? 'Both Masters are now EXPOSED on the Grail War Status Board!' : 'Attacking Master identity is now publicly exposed for violating Secrecy!' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'leak') {
      const intelText = interaction.options.getString('intel', true);
      const targetQuery = interaction.options.getString('target');
      const res = leakIntelInWar(war, interaction.user.username, intelText, targetQuery || undefined);

      const embed = new EmbedBuilder()
        .setTitle('🕵️ Holy Grail War: Intelligence Leak Broadcasted')
        .setDescription(res.message)
        .setColor(0xa855f7)
        .setFooter({ text: 'Information updated on the Holy Grail War Intelligence Board' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'skirmish') {
      const result = simulateWarSkirmish(war);
      const aliveCount = Object.values(result.updatedWar.participants).filter(x => x.isAlive).length;

      const resultEmbed = new EmbedBuilder()
        .setTitle('💥 Holy Grail War: City Skirmish')
        .setDescription(
          \`\${result.message}\\n\\n\` +
          \`👥 **Surviving Masters:** \${aliveCount}/7 alive\`
        )
        .setColor(0xef4444);

      await interaction.editReply({ embeds: [resultEmbed] });
      return;
    }

    let actionType: 'rest_and_heal' | 'betray_ally' = 'rest_and_heal';
    if (sub === 'betray') actionType = 'betray_ally';

    const result = executeWarAction(war, interaction.user.id, actionType);

    const resultEmbed = new EmbedBuilder()
      .setTitle(result.success ? '✅ Holy Grail War Action Completed' : '⚠️ Action Failed')
      .setDescription(result.message)
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
