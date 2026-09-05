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
import { getOrInitWarSession, exposeMasterInWar } from '../engine/grailwar';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';
import { allocateStatPoints, calculateServantMaxHp, calculateServantMaxAtk } from '../engine/statSystem';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('servant')
  .setDescription('Master Servant Workshop — parameters, stat allocation, Noble Phantasm, dialogues & roster')
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Select workshop section to open')
      .setRequired(false)
      .addChoices(
        { name: '📊 Parameters & Status', value: 'profile' },
        { name: '⭐ Parameter Stat Points', value: 'stats' },
        { name: '💥 Noble Phantasm Art', value: 'np' },
        { name: '💬 Dialogue & Voice Lines', value: 'dialogue' },
        { name: '📜 Contracted Roster', value: 'roster' }
      )
  );

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const initialCategory = (interaction.options.getString('category') as any) || 'profile';

    if (!master.servants || master.servants.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('🕯️ No Contracted Heroic Spirit')
        .setDescription(
          'You have not summoned any Heroic Spirit yet for the Holy Grail War!\n\n' +
          'Use `/gacha` or `/summon ritual` to invoke the Throne of Heroes and form your sacred covenant.'
        )
        .setColor(0xef4444);

      const summonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('go_gacha')
          .setLabel('Open Gacha Sanctum (/gacha)')
          .setEmoji('🔮')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('go_summon')
          .setLabel('Summon Ritual')
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
        if (i.customId === 'go_gacha') {
          await i.reply({ content: 'Opening `/gacha` Invocation Sanctum!', ephemeral: true });
        } else if (i.customId === 'go_summon') {
          await i.reply({ content: 'Use the `/summon ritual` command to summon your Heroic Spirit!', ephemeral: true });
        }
      });
      return;
    }

    const activeServant =
      master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    const { embeds, files, components } = await buildServantHub(master, activeServant, initialCategory);

    const msg = await interaction.editReply({
      embeds,
      files,
      components
    });

    attachServantCollector(msg, interaction.user.id, master, activeServant, initialCategory);

  } catch (error: any) {
    console.error('Error executing /servant:', error);
    await interaction.editReply({
      content: `❌ Error fetching servant profile: ${error.message}`
    });
  }
}

// ==========================================
// 3. SERVANT HUB BUILDER
// ==========================================
export async function buildServantHub(
  master: any,
  activeServant: any,
  category: 'profile' | 'stats' | 'np' | 'dialogue' | 'roster' = 'profile',
  selectedServantId?: string
) {
  const targetServant = (selectedServantId ? master.servants.find((s: any) => s.id === selectedServantId) : null) || activeServant;
  const templateId = targetServant.templateId || targetServant.template?.id || targetServant.id;
  const canonical = SERVANT_DATABASE.find(
    s => s.id === templateId || 
         (s.name && targetServant.name && s.name.toLowerCase() === targetServant.name.toLowerCase()) ||
         (s.name && targetServant.template?.name && s.name.toLowerCase() === targetServant.template.name.toLowerCase())
  ) || targetServant.template || targetServant;
  
  const isCustom = targetServant.template?.isCustomOrMeme || canonical?.isCustomOrMeme;
  const t = isCustom ? { ...canonical, ...targetServant.template } : { ...(canonical || targetServant.template || targetServant) };
  const alloc = targetServant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = canonical?.baseStats || t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

  const strTotal = (base.strength || 10) + (alloc.strength || 0);
  const endTotal = (base.endurance || 10) + (alloc.endurance || 0);
  const agiTotal = (base.agility || 10) + (alloc.agility || 0);
  const mnaTotal = (base.mana || 10) + (alloc.mana || 0);
  const lckTotal = (base.luck || 10) + (alloc.luck || 0);

  const ceBonusAtk = targetServant.equippedCe?.atkBonus || 0;
  const ceBonusHp = targetServant.equippedCe?.hpBonus || 0;
  const lvl = targetServant.level || 1;

  const baseHp = canonical?.baseHp || t.baseHp || 28000;
  const baseAtk = canonical?.baseAtk || t.baseAtk || 10000;
  const totalHp = Math.round(baseHp * (1 + (lvl - 1) * 0.05) + endTotal * 150 + ceBonusHp);
  const totalAtk = Math.round(baseAtk * (1 + (lvl - 1) * 0.05) + strTotal * 80 + ceBonusAtk);
  const bondLevel = targetServant.bondLevel || 1;
  const sName = targetServant.nickname || t.name;

  let embeds: EmbedBuilder[] = [];
  let files: AttachmentBuilder[] = [];

  const getRank = (score: number) => {
    if (score >= 40) return 'EX';
    if (score >= 30) return 'A+';
    if (score >= 25) return 'A';
    if (score >= 20) return 'B+';
    if (score >= 15) return 'B';
    if (score >= 10) return 'C';
    if (score >= 5) return 'D';
    return 'E';
  };

  if (category === 'profile') {
    const rawPassives = (t.passives && t.passives.length > 0)
      ? t.passives.slice(0, 2)
      : getDefaultClassPassives(t.servantClass).slice(0, 2);

    const passiveText = rawPassives.length > 0
      ? rawPassives.map((p: any, idx: number) => {
          if (idx === 0) return `• **${p.name}** [${p.rank || 'Passive'}] *(Active)* — ${p.description}`;
          if (idx === 1) {
            return bondLevel >= 5
              ? `• **${p.name}** [${p.rank || 'Passive'}] *(Active • Unlocked at Bond 5)* — ${p.description}`
              : `• 🔒 **${p.name}** [${p.rank || 'Passive'}] *(Locked — Unlocks at Bond Lv. 5)* — ${p.description}`;
          }
          return `• **${p.name}** [${p.rank || 'Passive'}] — ${p.description}`;
        }).join('\n')
      : 'None';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Servant Workshop — Profile Card: ${sName}`)
      .setDescription(
        `*${t.title}* • **Master:** ${master.username}\n` +
        `🌟 **Class:** ${t.servantClass} | **Rarity:** ${'★'.repeat(t.rarity)} | **Bond Lv:** ${bondLevel}/10 ♥ | **Level:** ${lvl}/100\n` +
        `❤️ **Max HP:** \`${totalHp.toLocaleString()}\` | ⚔️ **Total ATK:** \`${totalAtk.toLocaleString()}\` | 📈 **Stat Points:** **${targetServant.availableStatPoints || 0} pts**\n\n` +
        `📊 **Battle Parameters:**\n` +
        `• **Strength (STR):** \`${strTotal}\` [${getRank(strTotal)}] | **Endurance (END):** \`${endTotal}\` [${getRank(endTotal)}]\n` +
        `• **Agility (AGI):** \`${agiTotal}\` [${getRank(agiTotal)}] | **Mana (MNA):** \`${mnaTotal}\` [${getRank(mnaTotal)}] | **Luck (LCK):** \`${lckTotal}\` [${getRank(lckTotal)}]`
      )
      .addFields({
        name: '🛡️ Class Passive Skills',
        value: passiveText
      })
      .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);

    const artworkEmbed = new EmbedBuilder()
      .setImage(t.cardArtUrl || t.avatarUrl)
      .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);

    embeds = [embed, artworkEmbed];

    try {
      const cardBuffer = await renderServantProfileCard(targetServant, master.username);
      if (cardBuffer && cardBuffer.length > 500) {
        files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
      }
    } catch (e) {
      console.warn('Canvas render profile error:', e);
    }

  } else if (category === 'stats') {
    const availPoints = targetServant.availableStatPoints || 0;
    const embed = new EmbedBuilder()
      .setTitle(`⭐ Parameter Point Allocation: ${sName}`)
      .setDescription(
        `👑 **Servant:** **${sName}** (${t.servantClass}) • **Level:** Lv.${lvl}/100\n` +
        `📈 **Available Stat Points:** \`${availPoints} pts\` *(+10 pts per level up from feeding CEs!)*\n\n` +
        `💪 **Strength (STR):** \`${strTotal}\` [**${getRank(strTotal)}**] — *Increases base attack damage*\n` +
        `🛡️ **Endurance (END):** \`${endTotal}\` [**${getRank(endTotal)}**] — *Increases maximum health pool*\n` +
        `⚡ **Agility (AGI):** \`${agiTotal}\` [**${getRank(agiTotal)}**] — *Boosts crit generation and dodge rate*\n` +
        `🔮 **Mana (MNA):** \`${mnaTotal}\` [**${getRank(mnaTotal)}**] — *Accelerates NP gauge gain rate*\n` +
        `🍀 **Luck (LCK):** \`${lckTotal}\` [**${getRank(lckTotal)}**] — *Enhances status effect and crit resistance*\n\n` +
        `*Click a button below to allocate 1 point into the desired parameter or use Auto-Distribute.*`
      )
      .setColor(availPoints > 0 ? 0x22c55e : 0x38bdf8)
      .setFooter({ text: `Contracted to Master ${master.username} • Feed Craft Essences in /inventory to level up!` });

    embeds = [embed];

  } else if (category === 'np') {
    const gifUrl = getNoblePhantasmGif(t);
    const chant = targetServant.customQuotes?.noblePhantasm || getNoblePhantasmChant(t);
    const np = t.noblePhantasm;
    const stars = '⭐'.repeat(t.rarity || 5);
    const color = np.cardType === 'Buster' ? 0xef4444 : np.cardType === 'Arts' ? 0x3b82f6 : 0x10b981;

    const npEmbed = new EmbedBuilder()
      .setTitle(`💥 NOBLE PHANTASM: ${np.name}`)
      .setDescription(
        `> *"${chant || np.chant || 'True Name Unleashed!'}"*\n\n` +
        `• **Heroic Spirit:** **${t.name}** — *${t.title}* [\`${t.servantClass}\` ${stars}]\n` +
        `• **Card Type & Target:** **${np.cardType}** • **${np.target.toUpperCase()}**\n` +
        `• **Damage Multiplier:** \`${np.multiplier}%\` | **Overcharge:** ${np.overchargeEffect || 'Standard boost'}\n` +
        `• **True Name Power:** ${np.description}\n\n` +
        `🎬 *Cinematic Noble Phantasm Execution*`
      )
      .setColor(color)
      .setFooter({ text: `Contracted to Master ${master.username} • Holy Grail War Registry` });

    if (gifUrl) npEmbed.setImage(gifUrl);
    if (t.avatarUrl) npEmbed.setThumbnail(t.avatarUrl);

    embeds = [npEmbed];

  } else if (category === 'dialogue') {
    const quotes = targetServant.customQuotes || {};
    const embed = new EmbedBuilder()
      .setTitle(`💬 Master Dialogue Studio: ${sName}`)
      .setDescription(
        `*Author combat chants, chain shouts, and voice lines for **${sName}**!*\n\n` +
        `⚡ **COMBAT BRAVE CHAINS & NP:**\n` +
        `• 🔴 **Buster Brave:** *" ${quotes.busterChain || 'Default Canon Voice Line'} "*\n` +
        `• 🔵 **Arts Mana:** *" ${quotes.artsChain || 'Default Canon Voice Line'} "*\n` +
        `• 🟢 **Quick Star:** *" ${quotes.quickChain || 'Default Canon Voice Line'} "*\n` +
        `• 🌟 **Noble Phantasm:** *" ${quotes.noblePhantasm || t.noblePhantasm.chant} "*\n\n` +
        `📜 **INVOCATIONS & STANCES:**\n` +
        `• ⚔️ **Battle Start:** *" ${quotes.battleStart || t.battleStartQuote} "*\n` +
        `• 🏆 **Victory:** *" ${quotes.victory || t.victoryQuote} "*\n` +
        `• 💀 **Defeat:** *" ${quotes.defeat || t.defeatQuote || 'Master... forgive me...'} "*\n` +
        `• 🕯️ **Summon:** *" ${quotes.summon || t.summonQuote} "*\n\n` +
        `💡 *Set lines with \`/customise quote <type> "<text>"\` or preview with the buttons below.*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Contracted to Master ${master.username} • Bond Lv. ${bondLevel}` });

    embeds = [embed];

  } else if (category === 'roster') {
    const rosterList = master.servants.map((s: any, idx: number) => {
      const sN = s.nickname || s.template?.name || s.name || 'Heroic Spirit';
      const sCls = s.template?.servantClass || s.servantClass || 'Saber';
      const sRar = s.template?.rarity || s.rarity || 5;
      const isAct = master.activeServantId === s.id;
      const stars = '★'.repeat(sRar);
      const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
      return `${idx + 1}. **[${stars} ${sCls}]** **${sN}** — Lv.${s.level || 1}/100 | Points: \`${s.availableStatPoints || 0} pts\`${actBadge}\n   ↳ *NP: ${s.template?.noblePhantasm?.name || 'Classified'}*`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`📜 Contracted Heroic Spirits Roster (${master.servants.length})`)
      .setDescription(
        `Master **${master.username}** currently holds contracts with **${master.servants.length} Heroic Spirits**.\n\n` +
        rosterList +
        `\n\n*Select a Servant from the dropdown below to inspect their workshop profile or set as active contract.*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Holy Grail War Master Registry • Use /gacha to summon more spirits!` });

    embeds = [embed];
  }

  // --- BUILD UI COMPONENTS ---
  const categoryNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('servant_tab_profile')
      .setLabel('Parameters')
      .setEmoji('📊')
      .setStyle(category === 'profile' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_stats')
      .setLabel('Stat Points')
      .setEmoji('⭐')
      .setStyle(category === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_np')
      .setLabel('Noble Phantasm')
      .setEmoji('💥')
      .setStyle(category === 'np' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_dialogue')
      .setLabel('Voice Lines')
      .setEmoji('💬')
      .setStyle(category === 'dialogue' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_roster')
      .setLabel('Roster')
      .setEmoji('📜')
      .setStyle(category === 'roster' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>();

  if (category === 'stats') {
    const avail = targetServant.availableStatPoints || 0;
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_add_str').setLabel('+1 STR').setEmoji('💪').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_end').setLabel('+1 END').setEmoji('🛡️').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_agi').setLabel('+1 AGI').setEmoji('⚡').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_mna').setLabel('+1 MNA').setEmoji('🔮').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_auto').setLabel('Auto-Distribute').setEmoji('✨').setStyle(ButtonStyle.Primary).setDisabled(avail <= 0)
    );
  } else {
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_act_set_active').setLabel('Set as Active').setEmoji('👑').setStyle(ButtonStyle.Success).setDisabled(master.activeServantId === targetServant.id),
      new ButtonBuilder().setCustomId('servant_act_hear_voice').setLabel('Hear Voice Line').setEmoji('💬').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('servant_act_boast').setLabel('Boast to Server').setEmoji('📢').setStyle(ButtonStyle.Danger)
    );
  }

  const crossHubShortcutsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('servant_link_inventory').setLabel('Inventory (/inventory)').setEmoji('👔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('servant_link_gacha').setLabel('Gacha (/gacha)').setEmoji('🔮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('servant_link_grailwar').setLabel('War Board (/grailwar)').setEmoji('🏰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('servant_link_duel').setLabel('Duel Arena (/duel)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
  );

  const components: any[] = [categoryNavRow];

  // Roster Dropdown if multiple servants
  if (master.servants.length > 1) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('servant_sel_switch')
      .setPlaceholder(`Selected: ${sName} (Lv.${lvl})`)
      .addOptions(
        master.servants.slice(0, 25).map((s: any) => ({
          label: `${s.nickname || s.template?.name || 'Servant'} (${s.template?.servantClass || 'Saber'})`,
          description: `Lv. ${s.level || 1} • ★${s.template?.rarity || 5} • Available: ${s.availableStatPoints || 0} pts`,
          value: s.id,
          default: s.id === targetServant.id
        }))
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  components.push(actionButtonsRow);
  components.push(crossHubShortcutsRow);

  return { embeds, files, components };
}

// ==========================================
// 4. INTERACTION COLLECTOR
// ==========================================
export function attachServantCollector(
  message: any,
  userId: string,
  initialMaster: any,
  initialServant: any,
  initialCategory: 'profile' | 'stats' | 'np' | 'dialogue' | 'roster' = 'profile'
) {
  let currentCategory = initialCategory;
  let currentServantId = initialServant.id;

  const collector = message.createMessageComponentCollector({
    idle: 120000,
    time: 600000
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this command can interact with this workshop.', ephemeral: true });
      return;
    }
    collector.resetTimer();

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      let targetServant = master.servants.find((s: any) => s.id === currentServantId) || master.servants[0];

      // TAB NAVIGATION
      if (i.customId === 'servant_tab_profile') {
        currentCategory = 'profile';
      } else if (i.customId === 'servant_tab_stats') {
        currentCategory = 'stats';
      } else if (i.customId === 'servant_tab_np') {
        currentCategory = 'np';
      } else if (i.customId === 'servant_tab_dialogue') {
        currentCategory = 'dialogue';
      } else if (i.customId === 'servant_tab_roster') {
        currentCategory = 'roster';
      }
      // ROSTER DROPDOWN
      else if (i.customId === 'servant_sel_switch') {
        currentServantId = i.values[0];
        targetServant = master.servants.find((s: any) => s.id === currentServantId) || targetServant;
      }
      // SET ACTIVE CONTRACT
      else if (i.customId === 'servant_act_set_active') {
        master.activeServantId = targetServant.id;
        await saveMaster(master);
      }
      // STAT ALLOCATION
      else if (i.customId.startsWith('servant_add_')) {
        const statKey = i.customId.replace('servant_add_', '');
        const avail = targetServant.availableStatPoints || 0;
        if (avail > 0) {
          let updated = { ...targetServant };
          if (statKey === 'auto') {
            const stats: ('strength' | 'endurance' | 'agility' | 'mana' | 'luck')[] = ['strength', 'endurance', 'agility', 'mana', 'luck'];
            const toDist = Math.min(5, avail);
            for (let idx = 0; idx < toDist; idx++) {
              updated = allocateStatPoints(updated, stats[idx % stats.length], 1);
            }
          } else if (statKey === 'str') {
            updated = allocateStatPoints(updated, 'strength', 1);
          } else if (statKey === 'end') {
            updated = allocateStatPoints(updated, 'endurance', 1);
          } else if (statKey === 'agi') {
            updated = allocateStatPoints(updated, 'agility', 1);
          } else if (statKey === 'mna') {
            updated = allocateStatPoints(updated, 'mana', 1);
          } else if (statKey === 'lck') {
            updated = allocateStatPoints(updated, 'luck', 1);
          }

          master.servants = master.servants.map((s: any) => s.id === targetServant.id ? updated : s);
          await saveMaster(master);
          targetServant = updated;
        }
      }
      // HEAR VOICE LINE
      else if (i.customId === 'servant_act_hear_voice') {
        const quotes = [
          { label: 'Summon Quote', text: targetServant.customQuotes?.summon || targetServant.template.summonQuote },
          { label: 'Battle Start', text: targetServant.customQuotes?.battleStart || targetServant.template.battleStartQuote },
          { label: 'Noble Phantasm Chant', text: targetServant.customQuotes?.noblePhantasm || targetServant.template.noblePhantasm.chant },
          { label: 'Victory Quote', text: targetServant.customQuotes?.victory || targetServant.template.victoryQuote }
        ];
        const picked = quotes[Math.floor(Math.random() * quotes.length)];
        const diaEmbed = new EmbedBuilder()
          .setTitle(`💬 ${targetServant.nickname || targetServant.template.name} — [${picked.label}]`)
          .setDescription(`*"${picked.text}"*`)
          .setColor(0xd4af37);

        await i.reply({ embeds: [diaEmbed], ephemeral: true });
        return;
      }
      // BOAST TO SERVER
      else if (i.customId === 'servant_act_boast') {
        const war = getOrInitWarSession(master);
        exposeMasterInWar(war, master.discordId, 'public_command');
        await saveMaster(master);

        const template = targetServant.template;
        const starStr = '★'.repeat(template.rarity || 4);
        const announceEmbed = new EmbedBuilder()
          .setTitle(`📢 MASTER CHALLENGE: ${master.username.toUpperCase()} REVEALS SERVANT!`)
          .setDescription(
            `Master **${master.username}** has openly unveiled their contracted Heroic Spirit to all Masters in Fuyuki City!\n\n` +
            `⚔️ **True Name:** **${template.name}**\n` +
            `🗡️ **Class:** \`${template.servantClass}\` [${starStr}] | **Title:** *${template.title}*\n` +
            `💥 **Noble Phantasm:** *${template.noblePhantasm.name}* [${template.noblePhantasm.cardType.toUpperCase()}]\n` +
            `🗣️ *" ${targetServant.customQuotes?.summon || template.summonQuote || template.battleStartQuote} "*\n\n` +
            `⚠️ *By boasting openly, Master **${master.username}** is now permanently **EXPOSED** on the Holy Grail War board (\`/grailwar\`)!*`
          )
          .setImage(template.cardArtUrl || template.avatarUrl)
          .setColor(template.rarity === 5 ? 0xd4af37 : 0xef4444);

        if (i.channel && 'send' in i.channel) {
          await (i.channel as any).send({ embeds: [announceEmbed] });
        }
        await i.reply({
          content: '📢 You have revealed your Servant to the server! Your identity is now permanently exposed on the War Board.',
          ephemeral: true
        });
        return;
      }
      // CROSS-HUB SHORTCUTS
      else if (i.customId === 'servant_link_inventory') {
        await i.reply({ content: 'Use `/inventory` to access your Master Vault and equip Craft Essences!', ephemeral: true });
        return;
      } else if (i.customId === 'servant_link_gacha') {
        await i.reply({ content: 'Use `/gacha` to roll the Throne of Heroes and Craft Essence banners!', ephemeral: true });
        return;
      } else if (i.customId === 'servant_link_grailwar') {
        await i.reply({ content: 'Use `/grailwar` to view the 7-Master war roster, patrol sectors, and workshop defenses!', ephemeral: true });
        return;
      } else if (i.customId === 'servant_link_duel') {
        await i.reply({ content: 'Use `/duel` to enter the combat arena and test your tactical card chains!', ephemeral: true });
        return;
      }

      const hub = await buildServantHub(master, targetServant, currentCategory, currentServantId);
      await i.update({
        embeds: hub.embeds,
        files: hub.files,
        components: hub.components
      });

    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in servant collector:', err);
    }
  });
}
