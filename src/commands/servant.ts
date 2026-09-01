import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  AttachmentBuilder, 
  EmbedBuilder,
  StringSelectMenuBuilder, 
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { renderServantProfileCard, renderDialogueCard } from '../canvas/renderer';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
// The `/servant` command allows a Master to view their active Servant's parameters,
// Noble Phantasm chants, equipped Craft Essence, and generated visual status card.
export const data = new SlashCommandBuilder()
  .setName('servant')
  .setDescription('Inspect your contracted Heroic Spirit stats, Noble Phantasm, Craft Essence, and dialogue');

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer response immediately since image rendering can take up to 1-2 seconds
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    // Guard: Check if player has at least 1 Servant
    if (!master.servants || master.servants.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('❌ No Contracted Servant')
        .setDescription(
          'You have not summoned any Heroic Spirit yet for the Holy Grail War!\n\n' +
          'Use `/summon ritual` to invoke the Throne of Heroes and form your sacred contract.'
        )
        .setColor(0xef4444);

      const summonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('go_summon')
          .setLabel('Begin Summoning Ritual')
          .setEmoji('✨')
          .setStyle(ButtonStyle.Primary)
      );

      const reply = await interaction.editReply({ embeds: [emptyEmbed], components: [summonRow] });
      
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i: any) => i.user.id === interaction.user.id,
        time: 60000
      });

      collector.on('collect', async (i: any) => {
        if (i.customId === 'go_summon') {
          await i.reply({ content: 'Use the `/summon ritual` command to summon your Heroic Spirit!', ephemeral: true });
        }
      });
      return;
    }

    // Locate active servant
    const activeServant =
      master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    const embed = buildServantEmbed(activeServant, master);
    const rows = buildServantRows(master, activeServant);

    // Generate visual Canvas image card
    let files: AttachmentBuilder[] = [];
    try {
      const cardBuffer = await renderServantProfileCard(activeServant, master.username);
      if (cardBuffer && cardBuffer.length > 500) {
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' });
        embed.setImage('attachment://servant_profile.png');
        files.push(attachment);
      }
    } catch (e) {
      console.warn('Canvas render error in /servant:', e);
    }

    const msg = await interaction.editReply({
      embeds: [embed],
      files,
      components: rows
    });

    // Attach interaction listener for switching active servant or hearing voice lines
    setupServantCollector(msg, interaction.user.id, master);

  } catch (error: any) {
    console.error('Error executing /servant:', error);
    await interaction.editReply({
      content: `❌ Error fetching servant profile: ${error.message}`
    });
  }
}

// ==========================================
// 3. SERVANT EMBED BUILDER
// ==========================================
// Calculates total effective stats (Base + Parameters + CE) and formats the summary.
function buildServantEmbed(servant: any, master: any) {
  const t = servant.template || servant;
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

  const totalStr = (base.strength || 10) + (alloc.strength || 0);
  const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);
  const totalAgi = (base.agility || 10) + (alloc.agility || 0);
  const totalMna = (base.mana || 10) + (alloc.mana || 0);
  const totalLck = (base.luck || 10) + (alloc.luck || 0);

  const ceBonusAtk = servant.equippedCe?.atkBonus || 0;
  const ceBonusHp = servant.equippedCe?.hpBonus || 0;
  const lvl = servant.level || 1;

  const totalHp = Math.round((t.baseHp || 12000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

  const deckEmojiMap: Record<string, string> = { Buster: '🔴 Buster', Arts: '🔵 Arts', Quick: '🟢 Quick' };
  const commandDeck = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  const deckStr = commandDeck.map((c: string) => deckEmojiMap[c] || c).join(' • ');

  const npCardEmoji = t.noblePhantasm?.cardType === 'Arts' ? '🔵' : t.noblePhantasm?.cardType === 'Quick' ? '🟢' : '🔴';

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Servant Profile: ${servant.nickname || t.name}`)
    .setDescription(
      `*${t.title}*\n\n` +
      `🌟 **Class:** ${t.servantClass} | **Rarity:** ${'★'.repeat(t.rarity)} | **Bond Lv:** ${servant.bondLevel || 1}/10 ♥\n` +
      `📈 **Level:** ${servant.level || 1}/100 | **Available Stat Points:** **${servant.availableStatPoints || 0} pts**\n\n` +
      `❤️ **Max HP:** \`${totalHp.toLocaleString()}\` ${ceBonusHp ? `*(+${ceBonusHp} from CE)*` : ''}\n` +
      `⚔️ **Attack:** \`${totalAtk.toLocaleString()}\` ${ceBonusAtk ? `*(+${ceBonusAtk} from CE)*` : ''}\n\n` +
      `📊 **Base Parameters:**\n` +
      `• **STR:** ${totalStr} | **END:** ${totalEnd} | **AGI:** ${totalAgi}\n` +
      `• **MNA:** ${totalMna} | **LCK:** ${totalLck}\n\n` +
      `🃏 **Command Deck:** ${deckStr}\n\n` +
      (servant.equippedCe
        ? `🛡️ **Equipped CE:** **${servant.equippedCe.name}**\n*Effect:* ${servant.equippedCe.effectText}\n\n`
        : `🛡️ **Equipped CE:** *None (Use \`/customise equip\`)*\n\n`) +
      `💥 **Noble Phantasm:** **${t.noblePhantasm?.name || 'Unknown'}** [${npCardEmoji} ${t.noblePhantasm?.cardType || 'Buster'}]\n` +
      `> *"${servant.customQuotes?.noblePhantasm || t.noblePhantasm?.chant || '...'}"*\n` +
      `*${t.noblePhantasm?.description || ''}*`
    )
    .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);

  return embed;
}

// ==========================================
// 4. ACTION BUTTONS & SERVANT SWITCHER MENU
// ==========================================
function buildServantRows(master: any, activeServant: any) {
  const rows: any[] = [];

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('hear_dialogue')
      .setLabel('Hear Voice Lines')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('quick_duel_ai')
      .setLabel('Test in Duel Arena')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(buttonRow);

  // If the Master owns multiple Servants, provide a dropdown to switch active companion
  if (master.servants.length > 1) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('switch_active_servant')
      .setPlaceholder('Switch Contracted Active Servant...')
      .addOptions(
        master.servants.slice(0, 25).map((s: any) => ({
          label: `${s.template.name} (${s.template.servantClass})`,
          description: `Lv. ${s.level || 1} • ★${s.template.rarity}`,
          value: s.id,
          default: s.id === activeServant.id
        }))
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  return rows;
}

// ==========================================
// 5. INTERACTION COLLECTOR
// ==========================================
function setupServantCollector(message: any, userId: string, initialMaster: any) {
  const collector = message.createMessageComponentCollector({
    time: 120000 // 2 minutes
  });

  collector.on('collect', async (i: any) => {
    // Only the profile owner can click
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this command can interact with this profile.', ephemeral: true });
      return;
    }

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      const activeServant =
        master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

      // ACTION 1: Hear Voice Line (Generates visual visual dialogue box)
      if (i.customId === 'hear_dialogue') {
        const quotes = [
          { label: 'Summon Quote', text: activeServant.customQuotes?.summon || activeServant.template.summonQuote },
          { label: 'Battle Start', text: activeServant.customQuotes?.battleStart || activeServant.template.battleStartQuote },
          { label: 'Noble Phantasm Chant', text: activeServant.customQuotes?.noblePhantasm || activeServant.template.noblePhantasm.chant },
          { label: 'Victory Quote', text: activeServant.customQuotes?.victory || activeServant.template.victoryQuote }
        ];

        const picked = quotes[Math.floor(Math.random() * quotes.length)];

        let files: AttachmentBuilder[] = [];
        try {
          const diaBuffer = await renderDialogueCard(activeServant.template.name, picked.text, activeServant.template.title, activeServant.template.servantClass);
          if (diaBuffer && diaBuffer.length > 500) {
            files.push(new AttachmentBuilder(diaBuffer, { name: 'dialogue_card.png' }));
          }
        } catch {
          // Ignore canvas errors gracefully
        }

        const diaEmbed = new EmbedBuilder()
          .setTitle(`💬 ${activeServant.template.name} — [${picked.label}]`)
          .setDescription(`*"${picked.text}"*`)
          .setColor(0xd4af37);

        if (files.length > 0) {
          diaEmbed.setImage('attachment://dialogue_card.png');
        }

        await i.reply({ embeds: [diaEmbed], files, ephemeral: true });
        return;
      }

      // ACTION 2: Quick Duel Prompt
      if (i.customId === 'quick_duel_ai') {
        await i.reply({
          content: `⚔️ Initiate a tactical battle with \`/duel\` or invite another Master with \`/duel opponent:@Master\`!`,
          ephemeral: true
        });
        return;
      }

      // ACTION 3: Switch Active Servant Selection
      if (i.customId === 'switch_active_servant') {
        const selectedId = i.values[0];
        master.activeServantId = selectedId;
        await saveMaster(master);

        const newActive = master.servants.find((s: any) => s.id === selectedId) || master.servants[0];
        const newEmbed = buildServantEmbed(newActive, master);
        const newRows = buildServantRows(master, newActive);

        let files: AttachmentBuilder[] = [];
        try {
          const cardBuffer = await renderServantProfileCard(newActive, master.username);
          if (cardBuffer && cardBuffer.length > 500) {
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' });
            newEmbed.setImage('attachment://servant_profile.png');
            files.push(attachment);
          }
        } catch {
          // Ignore
        }

        await i.update({ embeds: [newEmbed], files, components: newRows });
      }

    } catch (err: any) {
      console.error('Error in servant collector:', err);
    }
  });
}
