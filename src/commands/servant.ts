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
, MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { renderServantProfileCard, renderDialogueCard } from '../canvas/renderer';
import { SERVANT_DATABASE, getDefaultClassPassives, getServantAvatarAndCardArt } from '../data/servants';
import { getServantProfile } from '../engine/dialogue';
import { getOrInitWarSession, exposeMasterInWar, getHealingStatus } from '../engine/grailwar';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';
import { allocateStatPoints, calculateServantMaxHp, calculateServantMaxAtk } from '../engine/statSystem';
import { equipCraftEssence, feedCraftEssences, getCeExpValue } from '../engine/customization';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('servant')
  .setDescription('Master Servant Workshop — parameters, stats, CE equipment, dialogues & roster')
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Select workshop section to open')
      .setRequired(false)
      .addChoices(
        { name: '📊 Parameters & Status', value: 'profile' },
        { name: '⭐ Parameter Stat Points', value: 'stats' },
        { name: '👔 Equip Craft Essence', value: 'equip_ce' },
        { name: '🧪 CE Synthesis & EXP Feed', value: 'feed_ce' },
        { name: '💥 Noble Phantasm Art', value: 'np' },
        { name: '💬 Dialogue & Voice Lines', value: 'dialogue' },
        { name: '📜 Contracted Roster', value: 'roster' }
      )
  );

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const initialCategory = (interaction.options.getString('category') as any) || 'profile';

    if (!master.servants || master.servants.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('🕯️ No Contracted Heroic Spirit')
        .setDescription(
          'You have not summoned any Heroic Spirit yet for the Holy Grail War!\n\n' +
          'Use `/summon ritual` to invoke the Throne of Heroes and form your sacred covenant for the war.'
        )
        .setColor(0xef4444);

      const summonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('go_summon')
          .setLabel('Begin Summoning Ritual (/summon)')
          .setEmoji('✨')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('go_gacha')
          .setLabel('Mystic Code Forge (/gacha)')
          .setEmoji('🛡️')
          .setStyle(ButtonStyle.Secondary)
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
          await i.reply({ content: 'Opening `/gacha` Invocation Sanctum!', flags: MessageFlags.Ephemeral });
        } else if (i.customId === 'go_summon') {
          await i.reply({ content: 'Use the `/summon ritual` command to summon your Heroic Spirit!', flags: MessageFlags.Ephemeral });
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
    if (error?.code === 10062 || error?.code === 40060 || error?.code === 50027 || error?.code === 10008 || error?.message?.includes('Unknown interaction') || error?.message?.includes('acknowledged')) return;
    console.error('Error executing /servant:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: `❌ Error fetching servant profile: ${error.message}`
        });
      } else {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Error fetching servant profile: ${error.message}`
        });
      }
    } catch {}
  }
}

// ==========================================
// 3. SERVANT HUB BUILDER
// ==========================================
export async function buildServantHub(
  master: any,
  activeServant: any,
  category: 'profile' | 'stats' | 'equip_ce' | 'feed_ce' | 'np' | 'dialogue' | 'roster' = 'profile',
  selectedServantId?: string,
  actionOutcomeMsg?: string,
  currentStep: number = 1
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
  const totalHp = Math.round(baseHp + endTotal * 150 + ceBonusHp);
  const totalAtk = Math.round(baseAtk + strTotal * 80 + ceBonusAtk);
  const bondLevel = targetServant.bondLevel || 1;
  const sName = targetServant.nickname || t.name;

  const war = getOrInitWarSession(master);
  const uPart = war?.participants?.[master.discordId];
  const healStatus = uPart ? getHealingStatus(uPart) : null;
  const currentHp = healStatus 
    ? healStatus.currentHp 
    : (targetServant.currentHp !== undefined ? Math.min(totalHp, Math.max(0, Math.round(targetServant.currentHp))) : totalHp);
  const hpPercent = totalHp > 0 ? Math.round((currentHp / totalHp) * 100) : 100;
  targetServant.currentHp = currentHp;

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
    // Command Deck
    const deckArr = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
    const deckStr = deckArr
      .map((c: string) => (c === 'Buster' ? '🔴 Buster' : c === 'Arts' ? '🔵 Arts' : '🟢 Quick'))
      .join(' • ');

    // Active Skills
    const skillLvls = targetServant.skillLevels || [1, 1, 1];
    const activeSkillsText = (t.skills && t.skills.length > 0)
      ? t.skills.map((s: any, idx: number) => {
          const icon = s.icon || (idx === 0 ? '⚔️' : idx === 1 ? '🛡️' : '✨');
          const sLvl = skillLvls[idx] || 1;
          return `• **${icon} Skill ${idx + 1}: ${s.name}** [Lv.${sLvl} • CD: ${s.cooldown}T]\n  *${s.description}*`;
        }).join('\n')
      : '• *No active skills registered.*';

    // Passive Skills
    const rawPassives = (t.passives && t.passives.length > 0)
      ? t.passives.slice(0, 2)
      : getDefaultClassPassives(t.servantClass).slice(0, 2);

    const passiveText = rawPassives.length > 0
      ? rawPassives.map((p: any, idx: number) => {
          if (idx === 0) return `• **${p.name}** [${p.rank || 'Passive'}] *(Active • Bond 1)* — ${p.description}`;
          if (idx === 1) {
            return bondLevel >= 5
              ? `• **${p.name}** [${p.rank || 'Passive'}] *(Active • Bond 5 Unlocked)* — ${p.description}`
              : `• 🔒 **${p.name}** [${p.rank || 'Passive'}] *(Locked — Reaches Bond Lv. 5 to unlock)* — ${p.description}`;
          }
          return `• **${p.name}** [${p.rank || 'Passive'}] — ${p.description}`;
        }).join('\n')
      : 'None';

    // Noble Phantasm
    const np = t.noblePhantasm || {
      name: 'Excalibur',
      cardType: 'Buster',
      chant: 'Sword of Promised Victory!',
      target: 'single',
      multiplier: 600,
      description: 'Deals massive damage to a single enemy.'
    };
    const npCardEmoji = np.cardType === 'Buster' ? '🔴' : np.cardType === 'Arts' ? '🔵' : '🟢';
    const npChant = targetServant.customQuotes?.noblePhantasm || np.chant || 'True Name Release!';

    const npText = 
      `• **True Name:** **${np.name}** (${npCardEmoji} ${np.cardType} • ${np.target ? np.target.toUpperCase() : 'SINGLE'})\n` +
      `  > *"${npChant}"*\n` +
      `• **Multiplier:** \`${np.multiplier || 600}%\` | **Overcharge:** ${np.overchargeEffect || 'Standard damage boost'}\n` +
      `• **Effect:** ${np.description}`;

    // Craft Essence
    const currentEq = targetServant.equippedCe;
    const ceText = currentEq
      ? `• **${currentEq.name}** (${'★'.repeat(currentEq.rarity)}) — \`+${(currentEq.atkBonus || 0).toLocaleString()} ATK\` | \`+${(currentEq.hpBonus || 0).toLocaleString()} HP\`\n  *Passive Effect: ${currentEq.effectText || 'Stat boost granted in battle.'}*`
      : '• *No Craft Essence equipped. Click "Equip CE" below or use /customise equip to link a relic.*';

    // Voice Lines & Quotes
    const customQ = targetServant.customQuotes || {};
    const quotesText = 
      `• 🕯️ **Summon:** *"${customQ.summon || t.summonQuote || 'I answer your call, Master.'}"*\n` +
      `• ⚔️ **Battle Start:** *"${customQ.battleStart || t.battleStartQuote || 'Enemies ahead!'}"*\n` +
      `• 🏆 **Victory:** *"${customQ.victory || t.victoryQuote || 'A victorious battle.'}"*`;

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Servant Workshop — Profile Card: ${sName}`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `*${t.title}* • **Master:** ${master.username}\n` +
        `🌟 **Class:** ${t.servantClass} | **Status:** ⚖️ Balanced Parity | **Bond Lv:** ${bondLevel}/10 ♥ | **Level:** Lv.${lvl}/100\n` +
        `❤️ **HP:** \`${currentHp.toLocaleString()} / ${totalHp.toLocaleString()}\` (${hpPercent}%) | ⚔️ **Total ATK:** \`${totalAtk.toLocaleString()}\` | 📈 **Stat Points:** **${targetServant.availableStatPoints || 0} pts**\n\n` +
        `📜 **Historical Legend & Lore:**\n> *${t.lore || 'A legendary heroic soul recorded in the Throne of Heroes, bound to fight in the Holy Grail War.'}*\n\n` +
        `📊 **Battle Parameters:**\n` +
        `• **Strength (STR):** \`${strTotal}\` [**${getRank(strTotal)}**] | **Endurance (END):** \`${endTotal}\` [**${getRank(endTotal)}**]\n` +
        `• **Agility (AGI):** \`${agiTotal}\` [**${getRank(agiTotal)}**] | **Mana (MNA):** \`${mnaTotal}\` [**${getRank(mnaTotal)}**] | **Luck (LCK):** \`${lckTotal}\` [**${getRank(lckTotal)}**]\n\n` +
        `🃏 **Command Deck:** ${deckStr}`
      )
      .addFields(
        { name: '⚡ Active Personal Skills', value: activeSkillsText },
        { name: '💥 Noble Phantasm', value: npText },
        { name: '🛡️ Class Passive Skills', value: passiveText },
        { name: '👔 Equipped Craft Essence', value: ceText },
        { name: '💬 Master Combat Invocations', value: quotesText }
      )
      .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);

    const { avatarUrl, cardArtUrl } = getServantAvatarAndCardArt(targetServant);

    if (avatarUrl) {
      safeSetEmbedThumbnail(embed, avatarUrl, files);
    }

    const artworkEmbed = new EmbedBuilder()
      .setTitle(`🖼️ Servant Character Portrait: ${sName}`)
      .setColor(t.rarity === 5 ? 0xd4af37 : 0x38bdf8);
    safeSetEmbedImage(artworkEmbed, cardArtUrl || avatarUrl, files);

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
    const stepLabel = currentStep >= 9999 ? 'MAX' : `${currentStep}`;

    const embed = new EmbedBuilder()
      .setTitle(`⭐ Parameter Point Allocation: ${sName}`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `👑 **Servant:** **${sName}** (${t.servantClass}) • **Level:** Lv.${lvl}/100\n` +
        `📈 **Available Stat Points:** \`${availPoints.toLocaleString()} pts\` *(+10 pts per level up from feeding CEs!)*\n\n` +
        `💪 **Strength (STR):** \`${strTotal}\` [**${getRank(strTotal)}**] — *Increases base attack damage*\n` +
        `🛡️ **Endurance (END):** \`${endTotal}\` [**${getRank(endTotal)}**] — *Increases maximum health pool*\n` +
        `⚡ **Agility (AGI):** \`${agiTotal}\` [**${getRank(agiTotal)}**] — *Boosts crit generation and dodge rate*\n` +
        `🔮 **Mana (MNA):** \`${mnaTotal}\` [**${getRank(mnaTotal)}**] — *Accelerates NP gauge gain rate*\n` +
        `🍀 **Luck (LCK):** \`${lckTotal}\` [**${getRank(lckTotal)}**] — *Enhances status effect and crit resistance*\n\n` +
        `💡 **BULK ALLOCATION METHODS:**\n` +
        `• **Step Multipliers:** Click \`1x\`, \`10x\`, \`50x\`, \`100x\`, or \`MAX\` to change increment size, then click parameter buttons.\n` +
        `• **Custom Numbers (Modal):** Click **📝 Custom Input** to type exact numeric amounts for each stat.\n` +
        `• **Auto-Distribute:** Click **✨ Auto-Distribute All** to split all remaining points evenly.`
      )
      .setColor(availPoints > 0 ? 0x22c55e : 0x38bdf8)
      .setFooter({ text: `Contracted to Master ${master.username} • Feed Craft Essences in /inventory to level up!` });

    embeds = [embed];

  } else if (category === 'equip_ce') {
    const ownedCes = (master.craftEssences || []).filter(Boolean);
    const currentEq = targetServant.equippedCe;

    const embed = new EmbedBuilder()
      .setTitle(`👔 Craft Essence Equipment Studio: ${sName}`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `👑 **Servant:** **${sName}** (${t.servantClass}) • **Level:** Lv.${lvl}/100\n` +
        `🛡️ **Currently Equipped:** ${currentEq ? `**${currentEq.name}** (★${currentEq.rarity}) — *${currentEq.effectText || 'Stat Boost'}*` : 'None (No Essence Equipped)'}\n\n` +
        `📦 **Inventory Collection:** You own **${ownedCes.length} Craft Essences**.\n` +
        `*Equipping a Craft Essence grants ATK (+1,000–3,000) & HP (+1,000–3,000) bonuses plus unique passives in combat!*\n\n` +
        `*Select an essence from the dropdown menu below to equip or click Unequip.*`
      )
      .setColor(currentEq ? 0x22c55e : 0x38bdf8)
      .setFooter({ text: `Master ${master.username} • Use /cegacha to pull new Craft Essences!` });

    embeds = [embed];

  } else if (category === 'feed_ce') {
    const ownedCes = (master.craftEssences || []).filter(Boolean);
    const availPts = targetServant.availableStatPoints || 0;

    const ceSummaryLines = ownedCes.slice(0, 6).map((c: any) => {
      const expVal = getCeExpValue(c);
      return `• **★${c.rarity || 3} ${c.name}** — Grants \`+${expVal.toLocaleString()} EXP\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🧪 Servant Enhancement & CE Synthesis: ${sName}`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `👑 **Servant:** **${sName}** (${t.servantClass})\n` +
        `📊 **Current Level:** \`Lv.${lvl}/100\` | **Total EXP:** \`${(targetServant.experience || 0).toLocaleString()} XP\`\n` +
        `⭐ **Unspent Stat Points:** \`${availPts} pts\` *(+10 Stat Points earned on every Level Up!)*\n\n` +
        `💡 **SYNTHESIS MECHANICS:**\n` +
        `Synthesize surplus Craft Essences from your inventory to bestow raw magical energy. Higher rarity CEs grant massive EXP boosts to accelerate Servant leveling.\n\n` +
        `📦 **Available CEs to Feed (${ownedCes.length}):**\n` +
        (ceSummaryLines || '• *No Craft Essences in inventory. Roll in /gacha!*') +
        `\n\n*Select a Craft Essence from the menu below to feed directly to **${sName}**!*`
      )
      .setColor(0x8b5cf6)
      .setFooter({ text: `Master ${master.username} • Servant Workshop Synthesis Portal` });

    embeds = [embed];

  } else if (category === 'np') {
    const gifUrl = getNoblePhantasmGif(t);
    const chant = targetServant.customQuotes?.noblePhantasm || getNoblePhantasmChant(t);
    const np = t.noblePhantasm;
    const color = np.cardType === 'Buster' ? 0xef4444 : np.cardType === 'Arts' ? 0x3b82f6 : 0x10b981;

    const npEmbed = new EmbedBuilder()
      .setTitle(`💥 NOBLE PHANTASM: ${np.name}`)
      .setDescription(
        `> *"${chant || np.chant || 'True Name Unleashed!'}"*\n\n` +
        `• **Heroic Spirit:** **${t.name}** — *${t.title}* [\`${t.servantClass}\`]\n` +
        `• **Card Type & Target:** **${np.cardType}** • **${np.target.toUpperCase()}**\n` +
        `• **Damage Multiplier:** \`${np.multiplier}%\` | **Overcharge:** ${np.overchargeEffect || 'Standard boost'}\n` +
        `• **True Name Power:** ${np.description}\n\n` +
        `🎬 *Cinematic Noble Phantasm Execution*`
      )
      .setColor(color)
      .setFooter({ text: `Contracted to Master ${master.username} • Holy Grail War Registry` });

    if (gifUrl) safeSetEmbedImage(npEmbed, gifUrl, files);
    if (t.avatarUrl) safeSetEmbedThumbnail(npEmbed, t.avatarUrl, files);

    embeds = [npEmbed];

  } else if (category === 'dialogue') {
    const quotes = targetServant.customQuotes || {};
    const profile = getServantProfile(sName);
    const busterDef = profile.buster[0] || "Blade of Selection... Strike true! Dragon Core, ignite!";
    const artsDef = profile.arts[0] || "With pure heart and steadfast oath... Prana circulation stable!";
    const quickDef = profile.quick[0] || "Invisible Air, release! Wind of the King, sweep the field!";

    const embed = new EmbedBuilder()
      .setTitle(`💬 Master Dialogue Studio: ${sName}`)
      .setDescription(
        `*Author combat chants, chain shouts, and voice lines for **${sName}**!*\n\n` +
        `⚡ **COMBAT BRAVE CHAINS & NP:**\n` +
        `• 🔴 **Buster Brave:** *" ${quotes.busterChain || busterDef} "*\n` +
        `• 🔵 **Arts Mana:** *" ${quotes.artsChain || artsDef} "*\n` +
        `• 🟢 **Quick Star:** *" ${quotes.quickChain || quickDef} "*\n` +
        `• 🌟 **Noble Phantasm:** *" ${quotes.noblePhantasm || t.noblePhantasm.chant} "*\n\n` +
        `📜 **INVOCATIONS & STANCES:**\n` +
        `• ⚔️ **Battle Start:** *" ${quotes.battleStart || t.battleStartQuote} "*\n` +
        `• 🏆 **Victory:** *" ${quotes.victory || t.victoryQuote} "*\n` +
        `• 💀 **Defeat:** *" ${quotes.defeat || t.defeatQuote || 'Forgive me, Master... My duty... remains unfulfilled...'} "*\n` +
        `• 🕯️ **Summon:** *" ${quotes.summon || t.summonQuote} "*\n\n` +
        `💡 *Set lines with \`/customise quote <type> "<text>"\`, click **Custom Dialogue Studio ✍️** below, or choose a Preset!*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Contracted to Master ${master.username} • Bond Lv. ${bondLevel}` });

    embeds = [embed];

  } else if (category === 'roster') {
    const rosterList = master.servants.map((s: any, idx: number) => {
      const sN = s.nickname || s.template?.name || s.name || 'Heroic Spirit';
      const sCls = s.template?.servantClass || s.servantClass || 'Saber';
      const isAct = master.activeServantId === s.id;
      const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
      return `${idx + 1}. **[${sCls}]** **${sN}** — Lv.${s.level || 1}/100 | Points: \`${s.availableStatPoints || 0} pts\`${actBadge}\n   ↳ *NP: ${s.template?.noblePhantasm?.name || 'Classified'}*`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`📜 Contracted Heroic Spirits Roster (${master.servants.length})`)
      .setDescription(
        `Master **${master.username}** currently holds contracts with **${master.servants.length} Heroic Spirits**.\n\n` +
        rosterList +
        `\n\n*Select a Servant from the dropdown below to inspect their workshop profile or set as active contract.*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Holy Grail War Master Registry • Use /gacha to forge Craft Essences!` });

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
      .setCustomId('servant_tab_equip_ce')
      .setLabel('Equip CE')
      .setEmoji('👔')
      .setStyle(category === 'equip_ce' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_feed_ce')
      .setLabel('Feed CEs')
      .setEmoji('🧪')
      .setStyle(category === 'feed_ce' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_dialogue')
      .setLabel('Voice Lines')
      .setEmoji('💬')
      .setStyle(category === 'dialogue' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const subNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('servant_tab_np')
      .setLabel('Noble Phantasm')
      .setEmoji('💥')
      .setStyle(category === 'np' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_tab_roster')
      .setLabel('Roster')
      .setEmoji('📜')
      .setStyle(category === 'roster' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('servant_act_set_active')
      .setLabel('Set Active')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Success)
      .setDisabled(master.activeServantId === targetServant.id),
    new ButtonBuilder()
      .setCustomId('servant_act_boast')
      .setLabel('Boast Profile')
      .setEmoji('📢')
      .setStyle(ButtonStyle.Danger)
  );

  const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>();
  let components: any[] = [categoryNavRow, subNavRow];

  // Roster Dropdown if multiple servants
  if (master.servants.length > 1) {
    const seenServantIds = new Set<string>();
    const servantOptions = master.servants.slice(0, 25).map((s: any, sIdx: number) => {
      let val = s.id || `servant_${sIdx}`;
      if (seenServantIds.has(val)) {
        val = `${val}_${sIdx}`;
      }
      seenServantIds.add(val);
      return {
        label: `${s.nickname || s.template?.name || 'Servant'} (${s.template?.servantClass || 'Saber'})`.slice(0, 100),
        description: `Lv. ${s.level || 1} • ${s.template?.servantClass || 'Heroic Spirit'} • Points: ${s.availableStatPoints || 0} pts`.slice(0, 100),
        value: val,
        default: s.id === targetServant.id
      };
    });
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('servant_sel_switch')
      .setPlaceholder(`Selected: ${sName} (Lv.${lvl})`)
      .addOptions(servantOptions);
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  if (category === 'profile') {
    const titleSelect = new StringSelectMenuBuilder()
      .setCustomId('servant_sel_title_preset')
      .setPlaceholder('👑 Select Custom Title / Nickname Preset...')
      .addOptions([
        { label: '👑 Title: King of Knights', description: 'Sets title to King of Knights', value: 'title_king_of_knights' },
        { label: '🗡️ Title: Sword of Promised Victory', description: 'Sets title to Sword of Promised Victory', value: 'title_promised_victory' },
        { label: '🛡️ Title: Bounded Field Guardian', description: 'Sets title to Bounded Field Guardian', value: 'title_sanctuary_warden' },
        { label: '🌟 Title: Grand Spirit of Legend', description: 'Sets title to Grand Spirit of Legend', value: 'title_grand_hero' },
        { label: '✨ Reset to True Name', description: 'Resets nickname back to canon True Name', value: 'title_reset' }
      ]);
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(titleSelect));

    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_act_hear_voice').setLabel('Hear Voice Line').setEmoji('💬').setStyle(ButtonStyle.Primary)
    );
    components.push(actionButtonsRow);
  } else if (category === 'dialogue') {
    const voiceSelect = new StringSelectMenuBuilder()
      .setCustomId('servant_sel_voice_preset')
      .setPlaceholder('💬 Apply Voice Line Chants & Dialogue Preset...')
      .addOptions([
        { label: '👑 Artoria Pendragon (Fate Canon)', description: 'True lore-accurate Fate/stay night & FGO voice lines', value: 'preset_artoria_canon' },
        { label: '🗡️ EMIYA (Unlimited Blade Works)', description: 'Tracing projection incantation and combat quotes', value: 'preset_emiya_ubw' },
        { label: '🔥 Gilgamesh (King of Heroes)', description: 'Vault of Babylon & Gate of Heaven quotes', value: 'preset_gilgamesh_king' },
        { label: '🔱 Cú Chulainn (Gáe Bolg Thrust)', description: 'Ulster Hound battle shouts & pierced heart quotes', value: 'preset_cu_lancer' },
        { label: '🖤 Jeanne d\'Arc Alter (Dragon Witch)', description: 'Dark flames of vengeance & burning quotes', value: 'preset_jalter_avenger' },
        { label: '✨ Reset to Pure Canon Defaults', description: 'Clears custom lines & uses exact database lore defaults', value: 'preset_reset_lore' }
      ]);
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(voiceSelect));

    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_act_open_dialogue_modal').setLabel('Custom Dialogue Studio').setEmoji('✍️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('servant_act_reset_dialogue').setLabel('Reset to Lore Defaults').setEmoji('✨').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servant_act_hear_voice').setLabel('Replay Cut-In').setEmoji('🎬').setStyle(ButtonStyle.Success)
    );
    components.push(actionButtonsRow);
  } else if (category === 'stats') {
    const avail = targetServant.availableStatPoints || 0;
    const stepLabel = currentStep >= 9999 ? 'MAX' : `${currentStep}`;

    // Row 1: Parameter Allocation Buttons (+Step)
    const paramRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servant_add_str').setLabel(`+${stepLabel} STR`).setEmoji('💪').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_end').setLabel(`+${stepLabel} END`).setEmoji('🛡️').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_agi').setLabel(`+${stepLabel} AGI`).setEmoji('⚡').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_mna').setLabel(`+${stepLabel} MNA`).setEmoji('🔮').setStyle(ButtonStyle.Success).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_lck').setLabel(`+${stepLabel} LCK`).setEmoji('🍀').setStyle(ButtonStyle.Success).setDisabled(avail <= 0)
    );

    // Row 2: Bulk Allocation & Step Controls (Max 5 buttons)
    const step100Label = currentStep >= 9999 ? 'MAX Step' : '100x Step';
    const ctrlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('servant_step_1').setLabel('1x').setStyle(currentStep === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servant_step_10').setLabel('10x').setStyle(currentStep === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servant_step_100').setLabel(step100Label).setStyle(currentStep >= 100 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('servant_act_open_stat_modal').setLabel('Custom Input').setEmoji('📝').setStyle(ButtonStyle.Primary).setDisabled(avail <= 0),
      new ButtonBuilder().setCustomId('servant_add_auto').setLabel('Auto-Distribute').setEmoji('✨').setStyle(ButtonStyle.Success).setDisabled(avail <= 0)
    );

    components.push(paramRow, ctrlRow);
  } else if (category === 'equip_ce') {
    const ownedCes = (master.craftEssences || []).filter(Boolean);
    const ceCounts = new Map<string, { ce: any; count: number }>();
    for (const c of ownedCes) {
      if (!c) continue;
      const id = c.id || c.name;
      if (!ceCounts.has(id)) {
        ceCounts.set(id, { ce: c, count: 1 });
      } else {
        ceCounts.get(id)!.count++;
      }
    }
    const uniqueCes = Array.from(ceCounts.values());
    const ceOptions = uniqueCes.slice(0, 25).map(({ ce, count }) => ({
      label: `★${ce.rarity || 3} ${ce.name}${count > 1 ? ` (x${count})` : ''}`.slice(0, 100),
      description: (ce.effectText || 'Craft Essence').slice(0, 100),
      value: ce.id || ce.name,
      default: targetServant.equippedCeId === ce.id
    }));
    if (ceOptions.length > 0) {
      const ceSelect = new StringSelectMenuBuilder()
        .setCustomId('servant_sel_equip_ce')
        .setPlaceholder('👔 Select Craft Essence to equip...')
        .addOptions(ceOptions);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(ceSelect));
    }
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_act_unequip_ce').setLabel('Unequip Current CE').setEmoji('🚫').setStyle(ButtonStyle.Danger).setDisabled(!targetServant.equippedCe)
    );
    components.push(actionButtonsRow);
  } else if (category === 'feed_ce') {
    const ownedCes = (master.craftEssences || []).filter(Boolean);
    const ceOptions = ownedCes.slice(0, 25).map((c: any, idx: number) => ({
      label: `★${c.rarity || 3} ${c.name} (+${getCeExpValue(c)} XP)`.slice(0, 100),
      description: (c.effectText || 'Craft Essence').slice(0, 100),
      value: String(idx)
    }));
    if (ceOptions.length > 0) {
      const feedSelect = new StringSelectMenuBuilder()
        .setCustomId('servant_sel_feed_ce')
        .setPlaceholder('🧪 Select Craft Essence(s) to synthesize (+EXP)...')
        .setMinValues(1)
        .setMaxValues(Math.min(ceOptions.length, 25))
        .addOptions(ceOptions);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(feedSelect));
    }
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_act_feed_3star').setLabel('Feed 1-3★ CEs').setEmoji('⚡').setStyle(ButtonStyle.Success).setDisabled(ownedCes.length === 0),
      new ButtonBuilder().setCustomId('servant_act_feed_dupes').setLabel('Feed Duplicates').setEmoji('🔥').setStyle(ButtonStyle.Primary).setDisabled(ownedCes.length === 0),
      new ButtonBuilder().setCustomId('servant_act_feed_all').setLabel('Feed All CEs').setEmoji('☣️').setStyle(ButtonStyle.Danger).setDisabled(ownedCes.length === 0)
    );
    components.push(actionButtonsRow);
  } else {
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('servant_act_hear_voice').setLabel('Hear Voice Line').setEmoji('💬').setStyle(ButtonStyle.Primary)
    );
    components.push(actionButtonsRow);
  }

  const crossHubShortcutsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('servant_link_inventory').setLabel('Inventory (/inventory)').setEmoji('👔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('servant_link_gacha').setLabel('Gacha (/gacha)').setEmoji('🔮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('servant_link_grailwar').setLabel('War Board (/grailwar)').setEmoji('🏰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('servant_link_duel').setLabel('Duel Arena (/duel)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
  );

  if (components.length < 5) {
    components.push(crossHubShortcutsRow);
  }

  // Strict safety cap: Discord allows maximum 5 Action Rows per message
  if (components.length > 5) {
    components = components.slice(0, 5);
  }

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
  initialCategory: 'profile' | 'stats' | 'equip_ce' | 'feed_ce' | 'np' | 'dialogue' | 'roster' = 'profile'
) {
  let currentCategory = initialCategory;
  let currentServantId = initialServant.id;
  let currentStep = 1;

  const collector = message.createMessageComponentCollector({
    idle: 120000,
    time: 600000
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this command can interact with this workshop.', flags: MessageFlags.Ephemeral });
      return;
    }
    collector.resetTimer();

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      let targetServant = master.servants.find((s: any) => s.id === currentServantId) || master.servants[0];
      const sName = targetServant?.nickname || targetServant?.template?.name || 'Servant';
      let actionOutcomeMsg = '';

      // TAB NAVIGATION
      if (i.customId === 'servant_tab_profile') {
        currentCategory = 'profile';
      } else if (i.customId === 'servant_tab_stats') {
        currentCategory = 'stats';
      } else if (i.customId === 'servant_tab_equip_ce') {
        currentCategory = 'equip_ce';
      } else if (i.customId === 'servant_tab_feed_ce') {
        currentCategory = 'feed_ce';
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
      // TITLE / NICKNAME PRESET DROPDOWN
      else if (i.customId === 'servant_sel_title_preset') {
        const val = i.values[0];
        let newTitle = '';
        if (val === 'title_king_of_knights') newTitle = 'King of Knights';
        else if (val === 'title_promised_victory') newTitle = 'Sword of Promised Victory';
        else if (val === 'title_sanctuary_warden') newTitle = 'Bounded Field Guardian';
        else if (val === 'title_grand_hero') newTitle = 'Grand Spirit of Legend';
        else if (val === 'title_reset') newTitle = '';

        targetServant.nickname = newTitle || undefined;
        master.servants = master.servants.map((s: any) => s.id === targetServant.id ? targetServant : s);
        await saveMaster(master);
        actionOutcomeMsg = newTitle ? `👑 Title updated to **"${newTitle}"**!` : `✨ Title reset to canon True Name!`;
      }
      // VOICE LINE / DIALOGUE PRESET DROPDOWN
      else if (i.customId === 'servant_sel_voice_preset') {
        const val = i.values[0];
        if (val === 'preset_reset_lore') {
          targetServant.customQuotes = {};
          actionOutcomeMsg = `✨ Cleared custom lines for **${sName}**! Reverted to exact canon lore defaults.`;
        } else {
          let presetQuotes = {};
          if (val === 'preset_artoria_canon' || val === 'preset_canon_knight') {
            presetQuotes = {
              noblePhantasm: 'Gathered breath of the planet, torrential stream of shining life... Take this! EX---CALIBUR!',
              battleStart: 'I take the field! Saber, Artoria Pendragon, moving out!',
              victory: 'The battle is decided. May honor guide our victory, Master.',
              defeat: 'Forgive me, Master... My duty... remains unfulfilled...',
              busterChain: 'Blade of Selection... Strike true! Dragon Core, ignite!',
              artsChain: 'With pure heart and steadfast oath... Prana circulation stable!',
              quickChain: 'Invisible Air, release! Wind of the King, sweep the field!',
              summon: 'Servant Saber. I have answered your summons. I ask of you, are you my Master?'
            };
          } else if (val === 'preset_emiya_ubw') {
            presetQuotes = {
              noblePhantasm: 'I am the bone of my sword... UNLIMITED BLADE WORKS!',
              battleStart: 'Analyzing structural blueprint... All blades stand ready.',
              victory: 'An iron will is sharper than any steel. Victory secured.',
              defeat: 'My entire life was Unlimited Blade Works... I falter here...',
              busterChain: 'Caladbolg II, overcharge projection! Shatter the perimeter!',
              artsChain: 'Tracing the origin, replicating craftsmanship... Steel is my body!',
              quickChain: 'Kanshou and Bakuya, dual arc trajectory! Intercepting flanks!',
              summon: 'Servant Archer. I have answered your call. Leave the tactics to me.'
            };
          } else if (val === 'preset_gilgamesh_king') {
            presetQuotes = {
              noblePhantasm: 'Look upon the glory of creation! ENUMA ELISH!',
              battleStart: 'Rejoice, mongrel! You are granted the honor of facing the King!',
              victory: 'Hahaha! Perfection is my minimum standard! Perish, fool!',
              defeat: 'How dare an insect push the King of Heroes this far?!',
              busterChain: 'Drown in the peerless treasures of Babylon! Insolent worm!',
              artsChain: 'A measured judgment from the Golden King. Accept your fate.',
              quickChain: 'Fleeing is useless! A flurry of treasures rains from heaven!',
              summon: 'Be honored, Master. You now stand in the presence of the King.'
            };
          } else if (val === 'preset_cu_lancer' || val === 'preset_fiery_vanguard') {
            presetQuotes = {
              noblePhantasm: 'Gáe Bolg! Spear of Striking Death Flight!',
              battleStart: 'Alright Master, point me at \'em and let me loose!',
              victory: 'Heh, not half bad! That\'s another win for the Hound of Ulster!',
              defeat: 'Tch... Battle Continuation isn\'t enough... catch you next time...',
              busterChain: 'Gáe Bolg won\'t miss! Full-force thrust straight through!',
              artsChain: 'Nordic runes align! Mana charging straight into the crimson spear!',
              quickChain: 'Too slow! The Hound leaves no tracks in the bloodied grass!',
              summon: 'Servant Lancer! The Hound of Culann answers your summons!'
            };
          } else if (val === 'preset_jalter_avenger' || val === 'preset_dark_avenger') {
            presetQuotes = {
              noblePhantasm: 'La Grondement du Haine! Burn to cinders!',
              battleStart: 'Your life expires here. Turn every single soul to ash!',
              victory: 'Ashes to ashes. None shall stand against my black flames!',
              defeat: 'Curse you all... My hatred is an infinite inferno!',
              busterChain: 'Burn! BURN TO CINDERS! There is no salvation for you!',
              artsChain: 'Curse the heavens, curse the earth... Dark fire burns brightest!',
              quickChain: 'Too slow! I\'ll carve you up before you even scream!',
              summon: 'I emerge from the dark flames to claim retribution.'
            };
          }
          targetServant.customQuotes = { ...(targetServant.customQuotes || {}), ...presetQuotes };
          actionOutcomeMsg = `💬 Applied voice line dialogue preset for **${sName}**! Replay cut-in to listen.`;
        }

        master.servants = master.servants.map((s: any) => s.id === targetServant.id ? targetServant : s);
        await saveMaster(master);
      }
      else if (i.customId === 'servant_act_reset_dialogue') {
        targetServant.customQuotes = {};
        master.servants = master.servants.map((s: any) => s.id === targetServant.id ? targetServant : s);
        await saveMaster(master);
        actionOutcomeMsg = `✨ Cleared custom quotes for **${sName}**! Restored to exact canon lore defaults.`;
      }
      else if (i.customId === 'servant_act_open_dialogue_modal') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`modal_quotes:${targetServant.id}`)
          .setTitle(`Custom Voice Lines: ${sName.slice(0, 20)}`);

        const quotes = targetServant.customQuotes || {};

        const busterInput = new TextInputBuilder()
          .setCustomId('quote_buster')
          .setLabel('🔴 Buster Brave Chain Line')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Blade of Selection... Strike true!')
          .setValue(quotes.busterChain || '')
          .setRequired(false);

        const artsInput = new TextInputBuilder()
          .setCustomId('quote_arts')
          .setLabel('🔵 Arts Mana Chain Line')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. With pure heart and steadfast oath!')
          .setValue(quotes.artsChain || '')
          .setRequired(false);

        const quickInput = new TextInputBuilder()
          .setCustomId('quote_quick')
          .setLabel('🟢 Quick Star Chain Line')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Invisible Air, release!')
          .setValue(quotes.quickChain || '')
          .setRequired(false);

        const npInput = new TextInputBuilder()
          .setCustomId('quote_np')
          .setLabel('💥 Noble Phantasm Chant')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Gathered breath of the planet... EX---CALIBUR!')
          .setValue(quotes.noblePhantasm || '')
          .setRequired(false);

        const startInput = new TextInputBuilder()
          .setCustomId('quote_battleStart')
          .setLabel('⚔️ Battle Start Quote')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. I take the field! Saber, moving out!')
          .setValue(quotes.battleStart || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder<any>().addComponents(busterInput),
          new ActionRowBuilder<any>().addComponents(artsInput),
          new ActionRowBuilder<any>().addComponents(quickInput),
          new ActionRowBuilder<any>().addComponents(npInput),
          new ActionRowBuilder<any>().addComponents(startInput)
        );

        await i.showModal(modal);
        return;
      }
      // QUICK FEED BUTTONS
      else if (i.customId === 'servant_act_feed_3star') {
        const owned = (master.craftEssences || []).filter(Boolean);
        const lowRarityIndexes = owned
          .map((c: any, idx: number) => ((c.rarity || 3) <= 3 ? String(idx) : null))
          .filter((v: any) => v !== null) as string[];
        if (lowRarityIndexes.length === 0) {
          actionOutcomeMsg = `⚠️ No 1-3★ Craft Essences found in inventory.`;
        } else {
          const result = feedCraftEssences(targetServant, lowRarityIndexes, owned);
          master.craftEssences = result.remainingCraftEssences;
          master.servants = master.servants.map((s: any) => s.id === targetServant.id ? result.updatedServant : s);
          await saveMaster(master);
          targetServant = result.updatedServant;
          const levelDiff = result.newLevel - result.oldLevel;
          actionOutcomeMsg = `⚡ Synthesized ${result.fedEssences.length} Low-Rarity (1-3★) Craft Essences!\n` +
            `• Gained \`+${result.expGained.toLocaleString()} XP\`\n` +
            (levelDiff > 0 ? `• **LEVEL UP!** Lv.${result.oldLevel} ➔ **Lv.${result.newLevel}**!\n• Gained **+${result.statPointsGained} Stat Points**!` : '');
        }
      } else if (i.customId === 'servant_act_feed_dupes') {
        const owned = (master.craftEssences || []).filter(Boolean);
        const nameCounts = new Map<string, number>();
        owned.forEach((c: any) => nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1));
        const dupeIndexes: string[] = [];
        const seenNames = new Set<string>();
        owned.forEach((c: any, idx: number) => {
          // Strictly protect 5★ SSR Craft Essences from bulk duplicate feeding
          if ((c.rarity || 3) >= 5) return;
          if ((nameCounts.get(c.name) || 0) > 1) {
            if (seenNames.has(c.name)) {
              dupeIndexes.push(String(idx));
            } else {
              seenNames.add(c.name);
            }
          }
        });
        if (dupeIndexes.length === 0) {
          actionOutcomeMsg = `⚠️ No duplicate 1-4★ Craft Essences found (5★ SSRs are protected).`;
        } else {
          const result = feedCraftEssences(targetServant, dupeIndexes, owned);
          master.craftEssences = result.remainingCraftEssences;
          master.servants = master.servants.map((s: any) => s.id === targetServant.id ? result.updatedServant : s);
          await saveMaster(master);
          targetServant = result.updatedServant;
          const levelDiff = result.newLevel - result.oldLevel;
          actionOutcomeMsg = `🔥 Synthesized ${result.fedEssences.length} Duplicate Craft Essences!\n` +
            `• Gained \`+${result.expGained.toLocaleString()} XP\`\n` +
            (levelDiff > 0 ? `• **LEVEL UP!** Lv.${result.oldLevel} ➔ **Lv.${result.newLevel}**!\n• Gained **+${result.statPointsGained} Stat Points**!` : '');
        }
      } else if (i.customId === 'servant_act_feed_all') {
        const owned = (master.craftEssences || []).filter(Boolean);
        if (owned.length === 0) {
          actionOutcomeMsg = `⚠️ No Craft Essences in inventory to synthesize.`;
        } else {
          const allIndexes = owned.map((_: any, idx: number) => String(idx));
          const result = feedCraftEssences(targetServant, allIndexes, owned);
          master.craftEssences = result.remainingCraftEssences;
          master.servants = master.servants.map((s: any) => s.id === targetServant.id ? result.updatedServant : s);
          await saveMaster(master);
          targetServant = result.updatedServant;
          const levelDiff = result.newLevel - result.oldLevel;
          actionOutcomeMsg = `☣️ Synthesized ALL ${result.fedEssences.length} Craft Essences!\n` +
            `• Gained \`+${result.expGained.toLocaleString()} XP\`\n` +
            (levelDiff > 0 ? `• **LEVEL UP!** Lv.${result.oldLevel} ➔ **Lv.${result.newLevel}**!\n• Gained **+${result.statPointsGained} Stat Points**!` : '');
        }
      }
      // EQUIP CRAFT ESSENCE DROPDOWN
      else if (i.customId === 'servant_sel_equip_ce') {
        const selectedCeId = i.values[0];
        const updated = equipCraftEssence(targetServant, selectedCeId);
        master.servants = master.servants.map((s: any) => s.id === targetServant.id ? updated : s);
        await saveMaster(master);
        targetServant = updated;
        actionOutcomeMsg = `✅ Successfully equipped **${updated.equippedCe?.name || 'Craft Essence'}**!`;
      }
      // UNEQUIP CRAFT ESSENCE
      else if (i.customId === 'servant_act_unequip_ce') {
        const updated = equipCraftEssence(targetServant, undefined);
        master.servants = master.servants.map((s: any) => s.id === targetServant.id ? updated : s);
        await saveMaster(master);
        targetServant = updated;
        actionOutcomeMsg = `🚫 Craft Essence unequipped.`;
      }
      // FEED CRAFT ESSENCE SYNTHESIS (Multi-select supported)
      else if (i.customId === 'servant_sel_feed_ce') {
        const ceIndices = i.values;
        const owned = (master.craftEssences || []).filter(Boolean);
        const result = feedCraftEssences(targetServant, ceIndices, owned);
        
        master.craftEssences = result.remainingCraftEssences;
        master.servants = master.servants.map((s: any) => s.id === targetServant.id ? result.updatedServant : s);
        await saveMaster(master);
        targetServant = result.updatedServant;

        const levelDiff = result.newLevel - result.oldLevel;
        actionOutcomeMsg = `✨ Synthesized ${result.fedEssences.length} Craft Essence${result.fedEssences.length > 1 ? 's' : ''}!\n` +
          `• Gained \`+${result.expGained.toLocaleString()} XP\`\n` +
          (levelDiff > 0 ? `• **LEVEL UP!** Lv.${result.oldLevel} ➔ **Lv.${result.newLevel}**!\n• Gained **+${result.statPointsGained} Stat Points**!` : '');
      }
      // SET ACTIVE CONTRACT
      else if (i.customId === 'servant_act_set_active') {
        master.activeServantId = targetServant.id;
        await saveMaster(master);
        actionOutcomeMsg = `👑 Contract updated! **${targetServant.nickname || targetServant.template?.name || 'Servant'}** is now your Active Servant.`;
      }
      // STEP MULTIPLIER TOGGLES
      else if (i.customId === 'servant_step_1') {
        currentStep = 1;
        actionOutcomeMsg = `🔢 Step multiplier set to **1x**. Click parameter buttons to add +1 point.`;
      } else if (i.customId === 'servant_step_10') {
        currentStep = 10;
        actionOutcomeMsg = `🔢 Step multiplier set to **10x**. Click parameter buttons to add +10 points!`;
      } else if (i.customId === 'servant_step_100') {
        if (currentStep === 100) {
          currentStep = 9999;
          actionOutcomeMsg = `⚡ Step multiplier toggled to **MAX**! Clicking a parameter button will allocate ALL remaining points!`;
        } else {
          currentStep = 100;
          actionOutcomeMsg = `🔢 Step multiplier set to **100x**. Click parameter buttons to add +100 points! (Click 100x again for MAX)`;
        }
      }
      // OPEN BULK STAT ALLOCATION MODAL
      else if (i.customId === 'servant_act_open_stat_modal') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const avail = targetServant.availableStatPoints || 0;
        const modal = new ModalBuilder()
          .setCustomId(`modal_allocate_stats:${targetServant.id}`)
          .setTitle(`Allocate Stats (${avail.toLocaleString()} pts)`);

        const strInput = new TextInputBuilder()
          .setCustomId('stat_str')
          .setLabel('💪 Strength (STR) Points to Add')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 100')
          .setRequired(false);

        const endInput = new TextInputBuilder()
          .setCustomId('stat_end')
          .setLabel('🛡️ Endurance (END) Points to Add')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 50')
          .setRequired(false);

        const agiInput = new TextInputBuilder()
          .setCustomId('stat_agi')
          .setLabel('⚡ Agility (AGI) Points to Add')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 50')
          .setRequired(false);

        const mnaInput = new TextInputBuilder()
          .setCustomId('stat_mna')
          .setLabel('🔮 Mana (MNA) Points to Add')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 100')
          .setRequired(false);

        const lckInput = new TextInputBuilder()
          .setCustomId('stat_lck')
          .setLabel('🍀 Luck (LCK) Points to Add')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 100')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder<any>().addComponents(strInput),
          new ActionRowBuilder<any>().addComponents(endInput),
          new ActionRowBuilder<any>().addComponents(agiInput),
          new ActionRowBuilder<any>().addComponents(mnaInput),
          new ActionRowBuilder<any>().addComponents(lckInput)
        );

        await i.showModal(modal);
        return;
      }
      // STAT ALLOCATION
      else if (i.customId.startsWith('servant_add_')) {
        const statKey = i.customId.replace('servant_add_', '');
        const avail = targetServant.availableStatPoints || 0;
        if (avail > 0) {
          let updated = { ...targetServant };
          if (statKey === 'auto') {
            const stats: ('strength' | 'endurance' | 'agility' | 'mana' | 'luck')[] = ['strength', 'endurance', 'agility', 'mana', 'luck'];
            const ptsPerStat = Math.floor(avail / 5);
            const remainder = avail % 5;

            const alloc = {
              strength: ptsPerStat + (remainder > 0 ? 1 : 0),
              endurance: ptsPerStat + (remainder > 1 ? 1 : 0),
              agility: ptsPerStat + (remainder > 2 ? 1 : 0),
              mana: ptsPerStat + (remainder > 3 ? 1 : 0),
              luck: ptsPerStat
            };
            updated = allocateStatPoints(updated, alloc);
            actionOutcomeMsg = `✨ Auto-distributed **${avail.toLocaleString()} Stat Points** evenly across all 5 parameters!`;
          } else {
            const amountToAdd = Math.min(currentStep, avail);
            let keyName: 'strength' | 'endurance' | 'agility' | 'mana' | 'luck' = 'strength';
            let label = 'STR';
            if (statKey === 'str') { keyName = 'strength'; label = 'STR'; }
            else if (statKey === 'end') { keyName = 'endurance'; label = 'END'; }
            else if (statKey === 'agi') { keyName = 'agility'; label = 'AGI'; }
            else if (statKey === 'mna') { keyName = 'mana'; label = 'MNA'; }
            else if (statKey === 'lck') { keyName = 'luck'; label = 'LCK'; }

            updated = allocateStatPoints(updated, keyName, amountToAdd);
            actionOutcomeMsg = `⚡ Allocated **+${amountToAdd.toLocaleString()} ${label}** into **${sName}**! (\`${updated.availableStatPoints.toLocaleString()} pts\` left)`;
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

        await i.reply({ embeds: [diaEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      // BOAST TO SERVER
      else if (i.customId === 'servant_act_boast') {
        const war = getOrInitWarSession(master);
        exposeMasterInWar(war, master.discordId, 'public_command');
        await saveMaster(master);

        const template = targetServant.template;
        const announceFiles: AttachmentBuilder[] = [];
        const announceEmbed = new EmbedBuilder()
          .setTitle(`📢 MASTER CHALLENGE: ${master.username.toUpperCase()} REVEALS SERVANT!`)
          .setDescription(
            `Master **${master.username}** has openly unveiled their contracted Heroic Spirit to all Masters in Fuyuki City!\n\n` +
            `⚔️ **True Name:** **${template.name}**\n` +
            `🗡️ **Class:** \`${template.servantClass}\` [Balanced Parity] | **Title:** *${template.title}*\n` +
            `💥 **Noble Phantasm:** *${template.noblePhantasm.name}* [${template.noblePhantasm.cardType.toUpperCase()}]\n` +
            `🗣️ *" ${targetServant.customQuotes?.summon || template.summonQuote || template.battleStartQuote} "*\n\n` +
            `⚠️ *By boasting openly, Master **${master.username}** is now permanently **EXPOSED** on the Holy Grail War board (\`/grailwar\`)!*`
          )
          .setColor(0xd4af37);
        safeSetEmbedImage(announceEmbed, template.cardArtUrl || template.avatarUrl, announceFiles);

        if (i.channel && 'send' in i.channel) {
          await (i.channel as any).send({ embeds: [announceEmbed], files: announceFiles });
        }
        await i.reply({
          content: '📢 You have revealed your Servant to the server! Your identity is now permanently exposed on the War Board.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      // CROSS-HUB SHORTCUTS
      else if (i.customId === 'servant_link_inventory') {
        await i.reply({ content: 'Use `/inventory` to access your Master Vault and equip Craft Essences!', flags: MessageFlags.Ephemeral });
        return;
      } else if (i.customId === 'servant_link_gacha') {
        await i.reply({ content: 'Use `/gacha` to roll the Throne of Heroes and Craft Essence banners!', flags: MessageFlags.Ephemeral });
        return;
      } else if (i.customId === 'servant_link_grailwar') {
        await i.reply({ content: 'Use `/grailwar` to view the 7-Master war roster, patrol sectors, and workshop defenses!', flags: MessageFlags.Ephemeral });
        return;
      } else if (i.customId === 'servant_link_duel') {
        await i.reply({ content: 'Use `/duel` to enter the combat arena and test your tactical card chains!', flags: MessageFlags.Ephemeral });
        return;
      }

      // Modals and ephemeral replies are handled above with immediate return
      // For hub updates that involve canvas rendering, defer update to avoid 3000ms Discord timeout
      if (!i.deferred && !i.replied) {
        await i.deferUpdate().catch(() => {});
      }

      const hub = await buildServantHub(master, targetServant, currentCategory, currentServantId, actionOutcomeMsg, currentStep);
      
      if (i.deferred || i.replied) {
        await i.editReply({
          embeds: hub.embeds,
          files: hub.files,
          components: hub.components
        });
      } else {
        await i.update({
          embeds: hub.embeds,
          files: hub.files,
          components: hub.components
        });
      }

    } catch (err: any) {
      if (
        err.code === 10062 || 
        err.code === 40060 || 
        err.code === 50027 || 
        err.message?.includes('Unknown interaction') || 
        err.message?.includes('already been acknowledged')
      ) {
        return;
      }
      console.error('Error in servant collector:', err);
    }
  });
}
