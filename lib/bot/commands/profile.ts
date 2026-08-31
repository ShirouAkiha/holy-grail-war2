/**
 * Slash Command: /profile
 * Description: View private Master dossier, contracted Servant stats & defense settings (Ephemeral)
 * Library: discord.js v14
 */

export const profileCommandCode = `import { 
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
  executeWarAction 
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
      .setDescription('❌ You have not entered the Holy Grail War yet. Use \`/summon\` to summon a Heroic Spirit and establish your contract.')
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

  let classPassive = 'None (Specializes in standard strategic match)';
  const sClass = userParticipant.servantClass;
  if (sClass === 'Saber' || sClass === 'Archer' || sClass === 'Lancer') {
    classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
  } else if (sClass === 'Assassin') {
    classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
  } else if (sClass === 'Berserker') {
    classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
  }

  const rarityStars = '⭐'.repeat(activeServant.rarity || 5);
  const np = activeServant.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', description: 'Sword of Promised Victory' };

  return new EmbedBuilder()
    .setTitle('👤 Secret Master Dossier | ' + master.username)
    .setDescription(
      '*(🔒 This confidential profile is only visible to you. Other Masters cannot see these details.)*\\n\\n' +
      (lastMsg ? ('📢 **Action Outcome:**\\n' + lastMsg + '\\n\\n') : '') +
      '⚔️ **Contracted Servant:**\\n' +
      '• **' + activeServant.name + '** [' + rarityStars + '] — Class: **' + activeServant.class + '**\\n' +
      '• **Noble Phantasm:** ✨ **' + np.name + '** (' + np.cardType + ')\\n' +
      '  *' + np.description + '*\\n\\n' +
      '📊 **Combat Parameters:**\\n' +
      '• **HP:** ❤️ \`' + userParticipant.currentHp.toLocaleString() + ' / ' + userParticipant.maxHp.toLocaleString() + '\`\\n' +
      '• **Base ATK:** ⚔️ \`' + (activeServant.baseStats?.atk || 12000).toLocaleString() + '\`\\n' +
      '• **Noble Phantasm Charge:** ⚡ \`100% Ready\`\\n\\n' +
      '🛡️ **Workshop Defenses & Wards:**\\n' +
      '• **Active Bounded Field:** ' + wardLabel + '\\n' +
      '• **Command Seal Auto-Evacuation:** ' + (autoEvade ? '🟢 **ENABLED** (Retreats to shadows with 1 HP on lethal blow)' : '🔴 **DISABLED**') + '\\n' +
      '• **Command Seals:** \`' + '✦ '.repeat(seals) + '✧ '.repeat(Math.max(0, 3 - seals)) + '\` (**' + seals + '/3** remaining)\\n\\n' +
      '👁️ **Servant Class Passive:**\\n' + classPassive + '\\n\\n' +
      '🏆 **Grail War Status:**\\n' +
      '• **Stealth Status:** ' + (isExposed ? '⚠️ **EXPOSED TO PUBLIC WAR BOARD**' : '🕶️ **Concealed in Shadows** (Anonymous to rivals)') + '\\n' +
      '• **Kills:** **' + (userParticipant.kills || 0) + '** | **Status:** ' + (userParticipant.isAlive ? '🟢 Active Competitor' : '💀 Eliminated') + '\\n\\n' +
      '*Configure your workshop defenses or manage your Servant using the buttons below:*'
    )
    .setColor(isExposed ? 0xef4444 : 0x3b82f6)
    .setFooter({ text: 'Private Master Dossier • Holy Grail War Protocol' });
}

export function buildProfileButtons(userParticipant: any) {
  const currentWard = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;

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
      .setLabel('Channel Mana (Heal)')
      .setEmoji('🩹')
      .setStyle(ButtonStyle.Success),
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
        content: '❌ You cannot inspect your Master Dossier without a contracted Servant! Use \`/summon\` first.'
      });
      return;
    }

    const war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    const embed = buildProfileEmbed(master, war);
    const buttons = buildProfileButtons(userParticipant);

    const reply = await interaction.reply({
      embeds: [embed],
      components: buttons,
      ephemeral: true,
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000
    });

    collector.on('collect', async (i: any) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Only the Master who opened this dossier can interact with it.', ephemeral: true });
        return;
      }

      try {
        const m = await getOrCreateMaster(i.user.id, i.user.username);
        let w = getOrInitWarSession(m);
        let msg = '';

        if (i.customId === 'profile_ward_none') {
          const res = executeWarAction(w, i.user.id, 'set_ward', 'none');
          w = res.updatedWar;
          msg = res.message;
          await saveMaster(m);
        } else if (i.customId === 'profile_ward_ward') {
          const res = executeWarAction(w, i.user.id, 'set_ward', 'ward');
          w = res.updatedWar;
          msg = res.message;
          await saveMaster(m);
        } else if (i.customId === 'profile_ward_alarm') {
          const res = executeWarAction(w, i.user.id, 'set_ward', 'alarm');
          w = res.updatedWar;
          msg = res.message;
          await saveMaster(m);
        } else if (i.customId === 'profile_toggle_evade') {
          const curP = w.participants[i.user.id];
          const newMode = curP?.autoEvadeEnabled !== false ? 'off' : 'on';
          const res = executeWarAction(w, i.user.id, 'toggle_evade', newMode);
          w = res.updatedWar;
          msg = res.message;
          await saveMaster(m);
        } else if (i.customId === 'profile_heal') {
          const res = executeWarAction(w, i.user.id, 'rest_and_heal');
          w = res.updatedWar;
          msg = res.message;
          await saveMaster(m);
        } else if (i.customId === 'profile_refresh') {
          msg = '🔄 Profile refreshed.';
        }

        const uP = w.participants[i.user.id];
        await i.update({
          embeds: [buildProfileEmbed(m, w, msg)],
          components: buildProfileButtons(uP)
        });
      } catch (err: any) {
        console.error('Error in profile collector:', err);
      }
    });

  } catch (error: any) {
    console.error('Error executing /profile:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Error: ' + error.message, ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Error: ' + error.message, ephemeral: true });
    }
  }
}
`;
