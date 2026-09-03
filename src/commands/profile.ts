import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  executeWarAction,
  getHealingStatus
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('👤 View your private Master profile, contracted Servant stats & defense settings (Ephemeral)');

export function buildProfileEmbed(master: any, war: any, lastMsg?: string) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const userParticipant = war.participants?.[master.discordId];

  if (!activeServant || !userParticipant) {
    return new EmbedBuilder()
      .setTitle('👤 Master Dossier | No Servant Contracted')
      .setDescription('❌ You have not entered the Holy Grail War yet. Use `/summon` to summon a Heroic Spirit and establish your contract.')
      .setColor(0x71717a);
  }

  const ward = userParticipant.boundedField || 'none';
  const autoEvade = userParticipant.autoEvadeEnabled !== false;
  const seals = userParticipant.commandSeals ?? 3;
  const isExposed = userParticipant.isExposed;

  let wardLabel = '🚫 **No Wards Active** (No perimeter defenses)';
  if (ward === 'ward') {
    wardLabel = '🛡️ **Sanctuary Bounded Field** (Absorbs 60% Ambush DMG)';
  } else if (ward === 'alarm') {
    wardLabel = '🚨 **Intrusion Alarm Trap** (Alerts & Deals 3,000 retaliatory DMG)';
  }

  const sTemplate = activeServant.template || activeServant;
  const servantName = activeServant.nickname || sTemplate.name || activeServant.name || 'Heroic Spirit';
  const servantClass = sTemplate.servantClass || activeServant.servantClass || activeServant.class || userParticipant?.servantClass || 'Saber';

  let classPassive = 'None (Specializes in standard strategic match)';
  if (servantClass === 'Saber' || servantClass === 'Archer' || servantClass === 'Lancer') {
    classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
  } else if (servantClass === 'Assassin') {
    classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
  } else if (servantClass === 'Berserker') {
    classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
  }

  const rarity = sTemplate.rarity || activeServant.rarity || 5;
  const rarityStars = '⭐'.repeat(rarity);
  const np = sTemplate.noblePhantasm || activeServant.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', target: 'aoe', description: 'Sword of Promised Victory' };
  const baseAtk = sTemplate.baseAtk || activeServant.baseAtk || activeServant.baseStats?.atk || 12000;

  const healInfo = getHealingStatus(userParticipant);

  const embed = new EmbedBuilder()
    .setTitle(`👤 Secret Master Dossier | ${master.username}`)
    .setDescription(
      `*(🔒 This confidential profile is only visible to you. Other Masters cannot see these details.)*\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `⚔️ **Contracted Servant:**\n` +
      `• **${servantName}** [${rarityStars}] — Class: **${servantClass}**\n` +
      `• **Noble Phantasm:** ✨ **${np.name}** [${np.cardType} • ${(np.target || 'single').toUpperCase()}]\n` +
      `  *${np.description}*\n\n` +
      `📊 **Combat Parameters & Health Recovery:**\n` +
      `• **HP:** ❤️ \`${healInfo.currentHp.toLocaleString()} / ${healInfo.maxHp.toLocaleString()}\` (${healInfo.percent}%)\n` +
      `• **Recovery State:** ${healInfo.statusTag}\n` +
      (healInfo.ritualCooldownSecs > 0 ? `• **Healing Ritual Cooldown:** ⏳ \`${Math.floor(healInfo.ritualCooldownSecs / 60)}m ${healInfo.ritualCooldownSecs % 60}s remaining\`\n` : `• **Healing Ritual:** ✨ \`Ready (+40% HP)\`\n`) +
      `• **Base ATK:** ⚔️ \`${baseAtk.toLocaleString()}\`\n` +
      `• **Noble Phantasm Charge:** ⚡ \`100% Ready\`\n\n` +
      `🛡️ **Workshop Defenses & Wards:**\n` +
      `• **Active Bounded Field:** ${wardLabel}\n` +
      `• **Command Seal Auto-Evacuation:** ${autoEvade ? '🟢 **ENABLED** (Retreats to shadows with 1 HP on lethal blow)' : '🔴 **DISABLED**'}\n` +
      `• **Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3** remaining)\n\n` +
      `👁️ **Servant Class Passive:**\n${classPassive}\n\n` +
      `🏆 **Grail War Status:**\n` +
      `• **Stealth Status:** ${isExposed ? '⚠️ **EXPOSED TO PUBLIC WAR BOARD**' : '🕶️ **Concealed in Shadows** (Anonymous to rivals)'}\n` +
      `• **Kills:** **${userParticipant.kills || 0}** | **Status:** ${userParticipant.isAlive ? '🟢 Active Competitor' : '💀 Eliminated'}\n\n` +
      `*Configure your workshop defenses or manage your Servant using the buttons below:*`
    )
    .setColor(isExposed ? 0xef4444 : 0x3b82f6)
    .setFooter({ text: 'Private Master Dossier • Holy Grail War Protocol' });

  return embed;
}

export function buildProfileButtons(userParticipant: any) {
  if (!userParticipant) return [];
  const currentWard = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;
  const healInfo = getHealingStatus(userParticipant);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_ward_none')
      .setLabel('No Wards')
      .setEmoji('🚫')
      .setStyle(currentWard === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_ward_ward')
      .setLabel('Sanctuary (60% Block)')
      .setEmoji('🛡️')
      .setStyle(currentWard === 'ward' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_ward_alarm')
      .setLabel('Alarm Trap (3k DMG)')
      .setEmoji('🚨')
      .setStyle(currentWard === 'alarm' ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_toggle_evade')
      .setLabel(autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴')
      .setStyle(autoEvade ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_heal')
      .setLabel(healInfo.ritualCooldownSecs > 0 ? `Healing Ritual (${Math.ceil(healInfo.ritualCooldownSecs / 60)}m)` : 'Healing Ritual (+40%)')
      .setEmoji('✨')
      .setStyle(healInfo.canRitualHeal ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_refresh')
      .setLabel('Refresh Profile')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
      });
      return;
    }

    const war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    const embed = buildProfileEmbed(master, war);
    const buttons = buildProfileButtons(userParticipant);

    await interaction.reply({
      embeds: [embed],
      components: buttons,
      ephemeral: true
    });
  } catch (error: any) {
    console.error('Error executing /profile:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
}
