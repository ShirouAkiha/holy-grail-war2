/**
 * Slash Command: /defenses
 * Description: Configure Mage Workshop Sanctuary Bounded Field & Command Seal Defenses
 * Library: discord.js v14
 */

export const defensesCommandCode = `import { 
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
  .setName('defenses')
  .setDescription('🏰 Configure your Mage Workshop Bounded Field & Command Seal defenses')
  .addStringOption(opt =>
    opt
      .setName('ward')
      .setDescription('Set Bounded Field ward type')
      .setRequired(false)
      .addChoices(
        { name: '🚫 No Wards (None)', value: 'none' },
        { name: '🛡️ Sanctuary Bounded Field (Absorbs 60% Ambush DMG)', value: 'ward' },
        { name: '🚨 Alarm Trap (Alerts & Deals 3,000 Retaliatory DMG)', value: 'alarm' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('auto_evacuate')
      .setDescription('Toggle Command Seal emergency escape on lethal damage')
      .setRequired(false)
      .addChoices(
        { name: '🟢 Enable Auto-Evacuation', value: 'on' },
        { name: '🔴 Disable Auto-Evacuation', value: 'off' }
      )
  );

function buildDefensesEmbed(userParticipant: any, lastMsg?: string) {
  const ward = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;
  const seals = userParticipant?.commandSeals ?? 3;

  let wardDescription = '🚫 **No Active Wards:** Your workshop has no magical perimeter defenses.';
  if (ward === 'ward') {
    wardDescription = '🛡️ **Mage\\\'s Sanctuary Bounded Field Active:** Multi-layered defensive barriers parry and absorb **60% of incoming ambush damage**.';
  } else if (ward === 'alarm') {
    wardDescription = '🚨 **Intrusion Alarm Trap Active:** Trapped boundary detects infiltrators, immediately alerting you and striking back for **3,000 retaliatory DMG**.';
  }

  let classPassive = 'None (Specializes in direct tactical matches)';
  const sClass = userParticipant?.servantClass;
  if (sClass === 'Saber' || sClass === 'Archer' || sClass === 'Lancer') {
    classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
  } else if (sClass === 'Assassin') {
    classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
  } else if (sClass === 'Berserker') {
    classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
  }

  return new EmbedBuilder()
    .setTitle('🏰 Mage Workshop & Personal Sanctuary Defenses')
    .setDescription(
      'Master **' + (userParticipant?.username || 'Master') + '**\\\'s Tactical Defense Headquarters\\n\\n' +
      (lastMsg ? ('📢 **Action Outcome:**\\n' + lastMsg + '\\n\\n') : '') +
      '🛡️ **Bounded Field Protocol:**\\n' + wardDescription + '\\n\\n' +
      '🔴 **Command Seal Emergency Evacuation:**\\n' +
      (autoEvade 
        ? '• **🟢 ENABLED:** When taking fatal ambush damage, consumes **1 Command Seal** to escape into shadows with **1 HP**.\\n'
        : '• **🔴 DISABLED:** Fatal ambushes will eliminate your Servant normally without consuming a seal.\\n') +
      '• **Current Command Seals:** ' + '✦ '.repeat(seals) + '✧ '.repeat(Math.max(0, 3 - seals)) + ' (**' + seals + '/3** remaining)\\n\\n' +
      '👁️ **Servant Class Passive:**\\n' + classPassive + '\\n\\n' +
      '*Configure your workshop defenses instantly using the buttons below or slash command arguments:*'
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Holy Grail War Defense Protocol • Use /grailwar status to view roster' });
}

function buildDefensesButtons(userParticipant: any) {
  const currentWard = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ward_none')
      .setLabel('No Wards')
      .setEmoji('🚫')
      .setStyle(currentWard === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ward_ward')
      .setLabel('Sanctuary (60% Block)')
      .setEmoji('🛡️')
      .setStyle(currentWard === 'ward' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ward_alarm')
      .setLabel('Alarm Trap (3k DMG)')
      .setEmoji('🚨')
      .setStyle(currentWard === 'alarm' ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_auto_evade')
      .setLabel(autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴')
      .setStyle(autoEvade ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_refresh_defenses')
      .setLabel('Refresh')
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
        content: '❌ You cannot enter the Holy Grail War without a contracted Servant! Use /summon first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    let lastMsg: string | undefined = undefined;

    const wardOpt = interaction.options.getString('ward');
    if (wardOpt) {
      const res = executeWarAction(war, interaction.user.id, 'set_ward', wardOpt);
      war = res.updatedWar;
      lastMsg = res.message;
      await saveMaster(master);
    }

    const evadeOpt = interaction.options.getString('auto_evacuate');
    if (evadeOpt) {
      const res = executeWarAction(war, interaction.user.id, 'toggle_evade', evadeOpt);
      war = res.updatedWar;
      lastMsg = res.message;
      await saveMaster(master);
    }

    const userParticipant = war.participants[interaction.user.id];
    const defEmbed = buildDefensesEmbed(userParticipant, lastMsg);
    const defButtons = buildDefensesButtons(userParticipant);

    const reply = await interaction.reply({
      embeds: [defEmbed],
      components: defButtons,
      ephemeral: true,
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000
    });

    collector.on('collect', async (i: any) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Only the Master who issued this command can configure workshop defenses.', ephemeral: true });
        return;
      }

      try {
        const m = await getOrCreateMaster(i.user.id, i.user.username);
        let w = getOrInitWarSession(m);

        if (i.customId === 'ward_none') {
          const res = executeWarAction(w, i.user.id, 'set_ward', 'none');
          w = res.updatedWar;
          await saveMaster(m);
          const uP = w.participants[i.user.id];
          await i.update({ embeds: [buildDefensesEmbed(uP, res.message)], components: buildDefensesButtons(uP) });
        } else if (i.customId === 'ward_ward') {
          const res = executeWarAction(w, i.user.id, 'set_ward', 'ward');
          w = res.updatedWar;
          await saveMaster(m);
          const uP = w.participants[i.user.id];
          await i.update({ embeds: [buildDefensesEmbed(uP, res.message)], components: buildDefensesButtons(uP) });
        } else if (i.customId === 'ward_alarm') {
          const res = executeWarAction(w, i.user.id, 'set_ward', 'alarm');
          w = res.updatedWar;
          await saveMaster(m);
          const uP = w.participants[i.user.id];
          await i.update({ embeds: [buildDefensesEmbed(uP, res.message)], components: buildDefensesButtons(uP) });
        } else if (i.customId === 'toggle_auto_evade') {
          const curP = w.participants[i.user.id];
          const newMode = curP?.autoEvadeEnabled !== false ? 'off' : 'on';
          const res = executeWarAction(w, i.user.id, 'toggle_evade', newMode);
          w = res.updatedWar;
          await saveMaster(m);
          const uP = w.participants[i.user.id];
          await i.update({ embeds: [buildDefensesEmbed(uP, res.message)], components: buildDefensesButtons(uP) });
        } else if (i.customId === 'war_refresh_defenses') {
          const uP = w.participants[i.user.id];
          await i.update({ embeds: [buildDefensesEmbed(uP, '🔄 Settings refreshed.')], components: buildDefensesButtons(uP) });
        }
      } catch (err: any) {
        console.error('Error in defenses collector:', err);
      }
    });

  } catch (error: any) {
    console.error('Error executing /defenses:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Error: ' + error.message, ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Error: ' + error.message, ephemeral: true });
    }
  }
}
`;
