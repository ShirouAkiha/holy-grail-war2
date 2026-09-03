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
import { SERVANT_DATABASE, getDefaultClassPassives } from '../data/servants';

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
        if (i.replied || i.deferred) return;
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
    const artworkEmbed = buildServantArtworkEmbed(activeServant);
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
      embeds: [embed, artworkEmbed],
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
function buildServantEmbed(servant: any, master: any) {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const canonical = SERVANT_DATABASE.find(
    s => s.id === templateId || 
         (s.name && servant.name && s.name.toLowerCase() === servant.name.toLowerCase()) ||
         (s.name && servant.template?.name && s.name.toLowerCase() === servant.template.name.toLowerCase())
  ) || servant.template || servant;
  
  const isCustom = servant.template?.isCustomOrMeme || canonical?.isCustomOrMeme;
  const t = isCustom ? { ...canonical, ...servant.template } : { ...(canonical || servant.template || servant) };
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = canonical?.baseStats || t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

  const totalStr = (base.strength || 10) + (alloc.strength || 0);
  const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);

  const ceBonusAtk = servant.equippedCe?.atkBonus || 0;
  const ceBonusHp = servant.equippedCe?.hpBonus || 0;
  const lvl = servant.level || 1;

  const baseHp = canonical?.baseHp || t.baseHp || 28000;
  const baseAtk = canonical?.baseAtk || t.baseAtk || 10000;
  const totalHp = Math.round(baseHp * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round(baseAtk * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

  const rawPassives = (t.passives && t.passives.length > 0)
    ? t.passives.slice(0, 2)
    : getDefaultClassPassives(t.servantClass).slice(0, 2);

  const bondLevel = servant.bondLevel || 1;
  const passiveText = rawPassives.length > 0
    ? rawPassives.map((p: any, idx: number) => {
        if (idx === 0) {
          return `• **${p.name}** [${p.rank || 'Passive'}] *(Active)* — ${p.description}`;
        }
        if (idx === 1) {
          if (bondLevel >= 5) {
            return `• **${p.name}** [${p.rank || 'Passive'}] *(Active • Unlocked at Bond 5)* — ${p.description}`;
          } else {
            return `• 🔒 **${p.name}** [${p.rank || 'Passive'}] *(Locked — Unlocks at Bond Lv. 5)* — ${p.description}`;
          }
        }
        return `• **${p.name}** [${p.rank || 'Passive'}] — ${p.description}`;
      }).join('\n')
    : 'None';

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Servant Profile Card: ${servant.nickname || t.name}`)
    .setDescription(
      `*${t.title}* • **Master:** ${master.username}\n` +
      `🌟 **Class:** ${t.servantClass} | **Rarity:** ${'★'.repeat(t.rarity)} | **Bond Lv:** ${bondLevel}/10 ♥ | **Level:** ${lvl}/100\n` +
      `❤️ **Max HP:** \`${totalHp.toLocaleString()}\` | ⚔️ **Total ATK:** \`${totalAtk.toLocaleString()}\` | 📈 **Stat Points:** **${servant.availableStatPoints || 0} pts**`
    )
    .addFields({
      name: '🛡️ Class Passive Skills (Max 2 • 2nd Unlocks at Bond Lv. 5)',
      value: passiveText
    })
    .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);

  return embed;
}

function buildServantArtworkEmbed(servant: any) {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const canonical = SERVANT_DATABASE.find(
    s => s.id === templateId || 
         (s.name && servant.name && s.name.toLowerCase() === servant.name.toLowerCase()) ||
         (s.name && servant.template?.name && s.name.toLowerCase() === servant.template.name.toLowerCase())
  ) || servant.template || servant;
  const t = { ...canonical, ...(servant.template?.isCustomOrMeme ? servant.template : {}) };
  const imgUrl = t.cardArtUrl || t.avatarUrl;
  return new EmbedBuilder()
    .setImage(imgUrl)
    .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);
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
    idle: 120000, // 2 minutes idle
    time: 600000 // 10 minutes total max
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    // Only the profile owner can click
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this command can interact with this profile.', ephemeral: true });
      return;
    }
    collector.resetTimer();

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      const activeServant =
        master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

      // ACTION 1: Hear Voice Line (Generates visual visual dialogue box)
      if (i.customId === 'hear_dialogue') {
        await i.deferReply({ ephemeral: true });

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

        await i.editReply({ embeds: [diaEmbed], files });
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
        await i.deferUpdate();

        const selectedId = i.values[0];
        master.activeServantId = selectedId;
        await saveMaster(master);

        const newActive = master.servants.find((s: any) => s.id === selectedId) || master.servants[0];
        const newEmbed = buildServantEmbed(newActive, master);
        const newArtworkEmbed = buildServantArtworkEmbed(newActive);
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

        await i.editReply({ embeds: [newEmbed, newArtworkEmbed], files, components: newRows });
      }

    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in servant collector:', err);
    }
  });
}
