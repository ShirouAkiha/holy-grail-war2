import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { MasterProfile, CraftEssence } from '../types';
import { RaidBossConfig } from '../data/raidBosses';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { addServantBattleExp, createExpEmberCraftEssence } from './customization';

export interface DarkSakuraKarmaRecord {
  kills: number;
  spares: number;
  mercyStreak: number;
  slayerStreak: number;
  betrayalCount: number;
  lastOutcome?: 'killed' | 'spared_mercy' | 'spared_betrayed' | 'peaceful';
  lastEncounterTime?: number;
}

export const DARK_SAKURA_ASSETS = {
  battleSprite: 'https://ella.janitorai.com/media-approved/1_g6bqriIhxa4tLhBalDY.webp',
  caveBackground: 'https://ella.janitorai.com/media-approved/P7i39PiVJeiUHbbq3dSn1.webp',
  vnDialogueSprite: 'https://ella.janitorai.com/media-approved/mOhtzJN0kQulMvmZWa0l2.webp',
  ultimateGif: 'https://ella.janitorai.com/media-approved/HPy75Hh7LlWM61QmUUPgf.webp'
};

/**
 * Safely extracts or initializes Dark Sakura's karma record for a Master.
 */
export function getDarkSakuraRecord(master: any): DarkSakuraKarmaRecord {
  if (!master.darkSakuraAffinity) {
    master.darkSakuraAffinity = {
      kills: 0,
      spares: 0,
      mercyStreak: 0,
      slayerStreak: 0,
      betrayalCount: 0
    };
  }
  const r = master.darkSakuraAffinity;
  r.kills = r.kills || 0;
  r.spares = r.spares || 0;
  r.mercyStreak = r.mercyStreak || 0;
  r.slayerStreak = r.slayerStreak || 0;
  r.betrayalCount = r.betrayalCount || 0;
  return r;
}

/**
 * Evaluates Dark Sakura's Temperament Tier for a Master:
 * - Tier 4: Pacifist Devotion (Sanctuary / Headpat Easter Egg)
 * - Tier 3: Wavering Maiden (High Spares >= 65%)
 * - Tier 2: Skeptic Magus (Balanced / New)
 * - Tier 1: The Butcher (High Kills >= 65%)
 */
export function getDarkSakuraTier(record: DarkSakuraKarmaRecord): 1 | 2 | 3 | 4 {
  const total = record.spares + record.kills;
  if (record.spares >= 30 && record.kills === 0) return 4;
  if (record.spares >= 50 && record.spares / Math.max(1, total) >= 0.95) return 4;

  if (total < 2) return 2; // Neutral for newcomers

  const ratio = record.spares / total;
  if (ratio >= 0.65) return 3;
  if (ratio <= 0.35) return 1;
  return 2;
}

/**
 * Calculates the trust probability (0.0 to 1.0) when a Master chooses to SPARE her.
 */
export function calculateSpareTrustChance(record: DarkSakuraKarmaRecord): number {
  const tier = getDarkSakuraTier(record);
  if (tier === 4) return 1.0;
  if (tier === 3) {
    // 75% to 92% based on mercy streak
    return Math.min(0.92, 0.75 + Math.min(record.mercyStreak * 0.03, 0.17));
  }
  if (tier === 1) {
    // 10% to 25% (very high risk of betrayal)
    return Math.max(0.10, 0.25 - Math.min(record.slayerStreak * 0.03, 0.15));
  }
  // Tier 2: 50% coin flip
  return 0.50;
}

/**
 * Scans party for special Fate/stay night Servant easter eggs.
 */
export function detectServantEasterEgg(participants: { servant: any }[]): { key: string; name: string; quote: string } | null {
  for (const p of participants) {
    const s = p.servant;
    const tId = (s.templateId || s.template?.id || '').toLowerCase();
    const sName = (s.template?.name || s.nickname || '').toLowerCase();

    if (tId.includes('medusa') || sName.includes('medusa') || (tId.includes('rider') && sName.includes('gorgon'))) {
      return {
        key: 'medusa',
        name: 'Medusa',
        quote: 'Rider...? You came for me? Please... don\'t look at me like that. I didn\'t want to become this monster...'
      };
    }
    if (tId.includes('gilgamesh') || sName.includes('gilgamesh')) {
      return {
        key: 'gilgamesh',
        name: 'Gilgamesh',
        quote: 'The King of Heroes... Fufu. I still remember how you tasted when my shadows swallowed you whole. Want another trip into my stomach?'
      };
    }
    if (tId.includes('emiya') || (sName.includes('emiya') && !sName.includes('alter') && !sName.includes('kiritsugu'))) {
      return {
        key: 'emiya',
        name: 'EMIYA',
        quote: "That red cloak... even in this endless cavern, you arrive with those hollow eyes to clean up the mess, don't you?"
      };
    }
    if (tId.includes('artoria_pendragon_alter') || sName.includes('saber alter') || (tId.includes('artoria') && sName.includes('alter'))) {
      return {
        key: 'salter',
        name: 'Artoria Alter',
        quote: 'Saber... You stayed by my side in the deep dark. Let\'s show this vanguard the true weight of the corrupted Grail.'
      };
    }
  }
  return null;
}

/**
 * Generates dynamic, self-aware intro dialogues taking into account:
 * - Solo vs Co-op Team
 * - Immediate rematch (< 10 mins)
 * - Last encounter outcome (betrayal vs mercy vs kill)
 * - Party composition contrasts (Host Mercy vs Ally Butcher)
 * - Servant easter eggs
 */
export function generateDarkSakuraIntroDialogue(
  participants: { master: any; servant: any; username: string; userId: string }[]
): { title: string; dialogue: string; bannerQuote: string; easterEggServant?: string } {
  const isMulti = participants.length > 1;
  const host = participants[0];
  const hostRecord = getDarkSakuraRecord(host.master);
  const hostTier = getDarkSakuraTier(hostRecord);

  const egg = detectServantEasterEgg(participants);

  const now = Date.now();
  const isQuickRematch = hostRecord.lastEncounterTime && (now - hostRecord.lastEncounterTime < 10 * 60 * 1000);

  let dialogue = '';
  let bannerQuote = '';

  if (isMulti) {
    // Multi-player team dynamics
    const tiers = participants.map(p => getDarkSakuraTier(getDarkSakuraRecord(p.master)));
    const hasSlayer = tiers.some(t => t === 1);
    const hasMercy = tiers.some(t => t >= 3);
    const allSlayers = tiers.every(t => t === 1);
    const allMercy = tiers.every(t => t >= 3);

    if (hostTier >= 3 && hasSlayer) {
      const slayerP = participants.find(p => getDarkSakuraTier(getDarkSakuraRecord(p.master)) === 1);
      dialogue = `*Wait...* Her crimson eyes flicker past you, locking onto **${slayerP?.username || 'your ally'}**.\n\n` +
        `*"${host.username}, who is this standing behind you? Their hands reek of my dried blood. Did you bring an executioner to finish what your soft heart couldn't in our previous clashes?"*`;
      bannerQuote = 'Did you bring a butcher to finish what your soft heart couldn\'t?';
    } else if (allSlayers) {
      dialogue = `*"A full circle of executioners gathered together... How flattering. You must really want to watch me dissolve under your noble phantasms today. Step into the mud then—let's see who breaks first."*`;
      bannerQuote = 'A full circle of executioners gathered together... How flattering.';
    } else if (allMercy) {
      dialogue = `*"Not a single killer among all four of you? A circle of saints marching straight into the abyss... Do you really think this mud won't swallow every last one of you if you hesitate?"*`;
      bannerQuote = 'A circle of saints marching straight into the abyss...';
    } else {
      dialogue = `*"Another vanguard gathered to harvest the corrupted Grail... Some of you have drawn my blood, others held out a hand in past bouts. Let's see which conviction triumphs today."*`;
      bannerQuote = 'Let\'s see which conviction triumphs today.';
    }
  } else {
    // Solo player dynamics
    if (hostRecord.spares === 0 && hostRecord.kills === 0) {
      dialogue = `*"The leyline whispers of a new challenger... Welcome to the bottom of the world, ${host.username}. Don't drown in my shadows."*`;
      bannerQuote = 'Welcome to the bottom of the world... Don\'t drown in my shadows.';
    } else if (isQuickRematch) {
      dialogue = `*"Back so soon? You barely cleaned the mud off your boots. Are you that eager to see me again, ${host.username}?"*`;
      bannerQuote = 'Back so soon? You barely cleaned the mud off your boots.';
    } else if (hostRecord.lastOutcome === 'spared_betrayed') {
      dialogue = `*"In our last bout... the shadows swallowed you before you could pull away. Yet you step right back into my cavern without flinching. Are you courageous, or just an idiot?"*`;
      bannerQuote = 'Yet you step right back into my cavern without flinching...';
    } else if (hostRecord.mercyStreak >= 3) {
      dialogue = `*"That's ${hostRecord.mercyStreak} consecutive bouts where you stayed your blade at the very end... When will you learn that monsters don't deserve fairy tales?"*`;
      bannerQuote = `When will you learn that monsters don't deserve fairy tales?`;
    } else if (hostRecord.slayerStreak >= 3) {
      dialogue = `*"Another round, another execution. You treat carving me apart like routine paperwork, don't you? Come on then... draw your weapon."*`;
      bannerQuote = 'You treat carving me apart like routine paperwork, don\'t you?';
    } else if (hostTier === 1) {
      dialogue = `*"Ah, the butcher returns. Eager to see if my core shatters faster this time? Let me show you what it feels like to rot in the mud."*`;
      bannerQuote = 'Ah, the butcher returns. Eager to carve me open again?';
    } else if (hostTier === 3) {
      dialogue = `*"You're back... Even in this pitch-black cavern, your presence feels warm. My shadows hesitate around you, ${host.username}."*`;
      bannerQuote = 'My shadows hesitate around you...';
    } else {
      dialogue = `*"Another bout. Are you going to cut me down like a true magus, or pretend to be my savior today? You Masters are all the same."*`;
      bannerQuote = 'Are you going to cut me down, or pretend to be my savior?';
    }
  }

  // Append servant Easter Egg if present
  if (egg) {
    dialogue += `\n\n👁️ **[Echoes of the Past]** *(Her gaze falls upon ${egg.name})*\n> *"–${egg.quote}"*`;
  }

  return {
    title: `🌑 SHADOW VESSEL: DARK SAKURA INTERLUDE`,
    dialogue,
    bannerQuote,
    easterEggServant: egg?.name
  };
}

/**
 * Evaluates whether the raid qualifies for the Tier 4 Pacifist Devotion Instant Clear!
 */
export function checkPacifistMilestone(
  participants: { master: any; servant: any; username: string; userId: string }[]
): { isEligible: boolean; sceneText: string; reason: string } {
  const host = participants[0];
  const hostRecord = getDarkSakuraRecord(host.master);
  const hostTier = getDarkSakuraTier(hostRecord);

  if (hostTier !== 4) {
    return { isEligible: false, sceneText: '', reason: 'Host is not Tier 4' };
  }

  // If in team, check if anyone has aggressive tier 1 karma
  if (participants.length > 1) {
    const hasSlayer = participants.some(p => getDarkSakuraTier(getDarkSakuraRecord(p.master)) === 1);
    if (hasSlayer) {
      return {
        isEligible: false,
        sceneText: '',
        reason: 'Host is peaceful, but an ally is a notorious Slayer.'
      };
    }
  }

  const sceneText =
    `*The cavern trembles, but instead of dark tendrils lashing out, the crimson markings softly subside into gentle lavender ribbons.*\n\n` +
    `*"Wait... put your weapons away. You've walked into this cavern ${hostRecord.spares} times, yet not once have you raised a blade with intent to harm me.\n\n` +
    `How many times have you reached your hand out into this pitch-black mud just to hold mine? ...Silly Master.\n\n` +
    `You don't need to fight me today."*\n\n` +
    `*Dark Sakura steps forward, smiling softly as she gently pats ${host.username}'s head. With a flick of her hand, she separates pure, untainted Grail nectar from the shadow abyss and places it into your hands.*`;

  return {
    isEligible: true,
    sceneText,
    reason: 'Pure Pacifist Devotion unlocked.'
  };
}

/**
 * Creates the special Craft Essence reward for successful high-trust sparing.
 */
function createDarkSakuraRibbonCe(): CraftEssence {
  return {
    id: `ce_dark_sakura_ribbon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Ribbon of the Hollow Night',
    title: 'Bond Relic of the Abyssal Maiden',
    rarity: 5,
    atkBonus: 1000,
    hpBonus: 1500,
    effectText: 'Increases Arts Card effectiveness by 15% and grants 10% NP Gauge at the start of battle.',
    passiveType: 'arts_up',
    passiveValue: 15,
    description: 'A crimson ribbon woven from shadow silk and fond memories. Proof of a Master who reached into the black mud without fear of being consumed.',
    cardArtUrl: DARK_SAKURA_ASSETS.vnDialogueSprite,
    artworkUrl: DARK_SAKURA_ASSETS.vnDialogueSprite
  };
}

/**
 * Executes the interactive End-of-Battle Climax:
 * Master(s) choose between [🌸 REACH OUT (Spare)] vs [⚔️ SEVER THE RIBBON (Execute)].
 * Personal resolutions ensure individual risk/reward without team griefing!
 */
export async function handleDarkSakuraClimax(
  battleMsg: any,
  boss: RaidBossConfig,
  battleState: any
): Promise<void> {
  const participants = battleState.participants;

  // Track each participant's choice: 'spare' | 'execute'
  const userChoices = new Map<string, 'spare' | 'execute'>();

  const buildClimaxEmbed = () => {
    const statusLines = participants.map((p: any) => {
      const choice = userChoices.get(p.userId);
      const icon = choice === 'spare' ? '🌸 **[SPARE]**' : choice === 'execute' ? '⚔️ **[EXECUTE]**' : '⏳ *Deciding...*';
      return `• <@${p.userId}> (${p.username}): ${icon}`;
    }).join('\n');

    return new EmbedBuilder()
      .setTitle('🌸 CLIMAX: THE FATE OF THE CORRUPTED VESSEL')
      .setDescription(
        `*Dark Sakura falls to her knees at the center of the cavern. The black mud around her writhes, yet her breathing is shallow and trembling.*\n\n` +
        `> *"Is it over...? Are you going to sever the core, or... reach out into the mud?"*\n\n` +
        `**Every Master must choose their conviction (30 seconds):**\n\n` +
        `⚔️ **[SEVER THE RIBBON (Execute)]**\n` +
        `• **100% Guaranteed Base Rewards** (18–25 SQ, 45,000 EXP, 4x Embers)\n` +
        `• Safe magus resolution. Lowers her trust for future bouts.\n\n` +
        `🌸 **[REACH OUT (Spare)]**\n` +
        `• **High-Stakes Gamble:** Tested against your personal trust ratio!\n` +
        `• **Success:** **2X DOUBLED DROPS** (36–50 SQ, 90,000 EXP, 8x Embers) + chance for ★5 CE *Ribbon of the Hollow Night*!\n` +
        `• **Failure:** The mud panics and devours you! Retreat with 0 SQ!\n\n` +
        `**Decisions of the Vanguard:**\n${statusLines}`
      )
      .setThumbnail(DARK_SAKURA_ASSETS.vnDialogueSprite)
      .setColor(0x831843)
      .setFooter({ text: 'Holy Grail War PvE • Consequential Raid Engine' });
  };

  const climaxButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('sakura_climax_spare')
      .setLabel('🌸 Reach Out (Spare)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('sakura_climax_execute')
      .setLabel('⚔️ Sever Ribbon (Execute)')
      .setStyle(ButtonStyle.Danger)
  );

  const promptMsg = await battleMsg.edit({
    content: '🚨 **THE FINAL DECISION OF THE HOLY GRAIL WAR**',
    embeds: [buildClimaxEmbed()],
    components: [climaxButtons],
    files: []
  }).catch(() => null);

  if (!promptMsg) return;

  const collector = promptMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000
  });

  collector.on('collect', async (btn: any) => {
    const isParticipant = participants.some((p: any) => p.userId === btn.user.id);
    if (!isParticipant) {
      await btn.reply({
        content: '❌ You are not a combatant in this raid.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return;
    }

    const choice = btn.customId === 'sakura_climax_spare' ? 'spare' : 'execute';
    userChoices.set(btn.user.id, choice);

    await btn.deferUpdate().catch(() => {});

    // Update display
    await promptMsg.edit({
      embeds: [buildClimaxEmbed()],
      components: [climaxButtons]
    }).catch(() => {});

    // If all participants chose, end early
    if (participants.every((p: any) => userChoices.has(p.userId))) {
      collector.stop('all_chosen');
    }
  });

  await new Promise<void>((resolve) => {
    collector.on('end', () => resolve());
  });

  // Resolve results for all participants
  const resultReports: string[] = [];
  const baseSq = Math.floor(boss.drops.minSq + Math.random() * (boss.drops.maxSq - boss.drops.minSq + 1));
  const baseExp = boss.drops.servantExp || 45_000;

  for (const p of participants) {
    const master = await getOrCreateMaster(p.userId, p.username);
    const record = getDarkSakuraRecord(master);
    record.lastEncounterTime = Date.now();

    // Default to execute if no choice was made in time
    const choice = userChoices.get(p.userId) || 'execute';

    if (choice === 'execute') {
      // Guaranteed safe rewards
      master.saintQuartz = (master.saintQuartz || 0) + baseSq;
      const s = master.servants?.find((sv: any) => sv.id === p.servant.id);
      if (s) {
        addServantBattleExp(s, baseExp);
      }
      master.craftEssences = master.craftEssences || [];
      master.craftEssences.push(
        createExpEmberCraftEssence(5, 1),
        createExpEmberCraftEssence(4, 2),
        createExpEmberCraftEssence(4, 3)
      );

      record.kills += 1;
      record.slayerStreak += 1;
      record.mercyStreak = 0;
      record.lastOutcome = 'killed';

      resultReports.push(
        `• <@${p.userId}> (**${p.username}**) chose **⚔️ EXECUTE**:\n` +
        `  └─ *Severed the shadow core cleanly.* Collected **+${baseSq} SQ** 💎, **+${baseExp.toLocaleString()} EXP** ⚔️, and 4x Embers.`
      );
    } else {
      // Sparing gamble!
      const trustChance = calculateSpareTrustChance(record);
      const isTrusted = Math.random() < trustChance;

      if (isTrusted) {
        // Double rewards!
        const doubleSq = baseSq * 2;
        const doubleExp = baseExp * 2;
        master.saintQuartz = (master.saintQuartz || 0) + doubleSq;
        const s = master.servants?.find((sv: any) => sv.id === p.servant.id);
        if (s) {
          addServantBattleExp(s, doubleExp);
        }
        master.craftEssences = master.craftEssences || [];
        master.craftEssences.push(
          createExpEmberCraftEssence(5, 2),
          createExpEmberCraftEssence(4, 4),
          createExpEmberCraftEssence(4, 5)
        );

        let ceDropNotice = '';
        // 25% chance of rare CE drop
        if (Math.random() < 0.25 || record.spares >= 20) {
          const ribbonCe = createDarkSakuraRibbonCe();
          master.craftEssences.push(ribbonCe);
          ceDropNotice = ` + 🌸 **[★5 Ribbon of the Hollow Night CE]**!`;
        }

        record.spares += 1;
        record.mercyStreak += 1;
        record.slayerStreak = 0;
        record.lastOutcome = 'spared_mercy';

        resultReports.push(
          `• <@${p.userId}> (**${p.username}**) chose **🌸 SPARE** — **[TRUST SUCCEEDED! (${Math.round(trustChance * 100)}% Chance)]**:\n` +
          `  └─ *The shadows receded with a trembling smile.* Received **DOUBLED REWARDS: +${doubleSq} SQ** 💎, **+${doubleExp.toLocaleString()} EXP** ⚔️, 8x Embers${ceDropNotice}`
        );
      } else {
        // Betrayal / mud devour!
        record.betrayalCount += 1;
        record.mercyStreak = 0;
        record.lastOutcome = 'spared_betrayed';

        // Minor pity EXP, 0 SQ
        const s = master.servants?.find((sv: any) => sv.id === p.servant.id);
        if (s) {
          addServantBattleExp(s, 5_000);
        }

        resultReports.push(
          `• <@${p.userId}> (**${p.username}**) chose **🌸 SPARE** — **[DEVOTION CONSUMED! (Failed ${Math.round(trustChance * 100)}% Trust)]**:\n` +
          `  └─ *The black mud flared out of control!* *"I'm sorry... I can't hold it back!!"* Engulfed in shadow! **0 SQ obtained.**`
        );
      }
    }

    await saveMaster(master);
  }

  // Final Embed
  const finalEmbed = new EmbedBuilder()
    .setTitle('🏆 RAID CONCLUDED: THE SHADOW’S PARTING')
    .setDescription(
      `*The ritual in the Fuyuki Abyssal Cavity dissolves back into the leylines...*\n\n` +
      `**Resolution & Spoils of War:**\n` +
      resultReports.join('\n\n') + `\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Her memory of your choices has been etched into the Grail.*`
    )
    .setImage(DARK_SAKURA_ASSETS.caveBackground)
    .setColor(0xbe185d)
    .setFooter({ text: 'Holy Grail War PvE • Consequential Raid Engine' });

  await promptMsg.edit({
    content: '✨ **The Raid Encounter Has Concluded.**',
    embeds: [finalEmbed],
    components: []
  }).catch(() => {});
}
