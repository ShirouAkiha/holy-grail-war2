import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  MessageFlags,
  AttachmentBuilder
} from 'discord.js';
import { MasterProfile, CraftEssence } from '../types';
import { RaidBossConfig } from '../data/raidBosses';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { addServantBattleExp, createExpEmberCraftEssence } from './customization';
import { renderDarkSakuraVNDialogueImage } from '../canvas/raidRenderer';

export interface DarkSakuraKarmaRecord {
  kills: number;
  spares: number;
  mercyStreak: number;
  slayerStreak: number;
  betrayalCount: number;
  lastOutcome?: 'killed' | 'spared_mercy' | 'spared_betrayed' | 'peaceful';
  lastEncounterTime?: number;
  lastIntroCategory?: string;
  introCategoryStreak?: number;
  dailyPacifistClaims?: number;
  lastDailyPacifistDate?: string;
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

  // Track and reset daily pacifist claims (max 5/day, UTC)
  const today = new Date().toISOString().slice(0, 10);
  if (r.lastDailyPacifistDate !== today) {
    r.dailyPacifistClaims = 0;
    r.lastDailyPacifistDate = today;
  }
  r.dailyPacifistClaims = r.dailyPacifistClaims || 0;

  return r;
}

/**
 * Evaluates Dark Sakura's Temperament Tier for a Master:
 * Extended progression scaled for deep investment and narrative weight:
 * - Tier 4: Pacifist Devotion (Sanctuary) - Requires 50+ total raids & (50+ mercies with 0 kills OR 40+ mercies with >=80% ratio & 10+ mercy streak)
 * - Tier 3: Wavering Maiden (Touched by Mercy) - Requires 30+ total raids & 20+ mercies with >=65% ratio & 5+ mercy streak (or 0 kills)
 * - Tier 1: The Butcher (Cold-blooded Executioner) - Requires 15+ total raids & 10+ kills with >=65% ratio & 5+ slayer streak
 * - Tier 2: Skeptic Magus (Guarded / Default) - Default for <30 raids, mixed karma, or early progression
 */
export function getDarkSakuraTier(record: DarkSakuraKarmaRecord): 1 | 2 | 3 | 4 {
  const mercyAttempts = record.spares + (record.betrayalCount || 0);
  const total = mercyAttempts + record.kills;

  // Tier 4: Pacifist Devotion (Requires 50+ total raids)
  if (total >= 50) {
    if (mercyAttempts >= 50 && record.kills === 0) return 4;
    if (mercyAttempts >= 40 && (mercyAttempts / total) >= 0.80 && record.mercyStreak >= 10) return 4;
  }

  // Tier 3: Wavering Maiden (Requires 30+ total raids)
  if (total >= 30) {
    const mercyRatio = mercyAttempts / total;
    if (mercyAttempts >= 20 && mercyRatio >= 0.65 && (record.mercyStreak >= 5 || (record.kills === 0 && mercyAttempts >= 30))) {
      return 3;
    }
  }

  // Tier 1: The Butcher (Requires 15+ total raids)
  if (total >= 15) {
    const killRatio = record.kills / total;
    if (record.kills >= 10 && killRatio >= 0.65 && record.slayerStreak >= 5) {
      return 1;
    }
  }

  // Tier 2: Skeptic Magus (Guarded / Neutral default)
  return 2;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates HP-reactive dialogue quotes for Dark Sakura during combat:
 * - 'boss_low_hp': Boss drops to <= 30% HP
 * - 'break_gauge': Break gauge shattered
 * - 'player_low_hp': A player Servant drops to <= 25% HP
 * - 'guts_survived': A player Servant survives a fatal hit with Guts
 */
export function getDarkSakuraHpReactiveQuote(
  trigger: 'boss_low_hp' | 'break_gauge' | 'player_low_hp' | 'guts_survived' | 'np_fired',
  record: DarkSakuraKarmaRecord,
  servantName?: string
): { quote: string } {
  const tier = getDarkSakuraTier(record);

  switch (trigger) {
    case 'boss_low_hp':
      if (tier === 4) {
        return {
          quote: pickRandom([
            "My vessel is breaking... but for the first time, I'm not afraid. If I collapse here, will you catch me before I hit the cold ground?",
            "The shadow is losing its grip on my body... Please, just stay close to me. Your presence is the only anchor keeping my soul anchored to this world.",
            "Even as my mana leaks into the dark... I can feel your heart beating next to mine. Thank you for never giving up on me...",
            "Even when I'm breaking apart... you still look at me with those warm eyes. Why won't you just let me rest?",
            "My vessel is shattering... but your blade never once sought my throat. Master... is this your kindness?"
          ])
        };
      }
      if (tier === 3) {
        return {
          quote: pickRandom([
            "My core is crumbling... but your hand didn't tremble when you stayed your blade before. Is this really the end?",
            "The black mud is spilling... don't step any closer, or my urges will devour you!",
            "I'm falling apart... but you still haven't drawn your weapon to finish me. Why?"
          ])
        };
      }
      if (tier === 1) {
        return {
          quote: pickRandom([
            "Fufu... You carve into my body so mercilessly! Go on then, executioner, finish your job!",
            "Ahaha! More blood for the mud! Cut me open as much as you like, butcher!",
            "Is that all your blades can do? I've bled for eleven years—this pain is nothing!"
          ])
        };
      }
      // Tier 2 (Skeptic Magus)
      return {
        quote: pickRandom([
          "My vessel is cracking open... Is this where you strike the killing blow, or will you hesitate like a foolish magus?",
          "Ugh... The black mud leaks everywhere! If you're going to finish me, do it now before the shadow takes over completely!",
          "Wounding me won't stop the Grail's curse! The deeper you cut, the darker the cavern becomes!",
          "Agh...! My core is unstable! Don't get arrogant just because my body is breaking!",
          "Fufu... You managed to push me this far? Now let's see if you have the stomach to deal with what comes next!"
        ])
      };

    case 'break_gauge':
      if (tier === 4) {
        return {
          quote: pickRandom([
            "The dark core shattered...! The corruption is leaking everywhere... Quick, take my hand before the mud pulls us apart!",
            "Aah...! The Grail's restraints broke! Don't look away... I'm holding back the shadow with everything I have for you!",
            "My vessel cracked wide open... but inside, the light you gave me is still burning bright!",
            "The seal shattered... The abyssal core is exposed. Please... don't let the shadow consume us both!",
            "My restraints broke...! Hold on... I'm trying to suppress the shadow!"
          ])
        };
      }
      if (tier === 1) {
        return {
          quote: pickRandom([
            "You shattered my vessel! Fufu... Ahaha! Is that all you've got? The abyss only gets deeper from here!",
            "Shattering my outer core only releases more shadow! Come, executioner, let's drown together!",
            "Ah... Such violence! You really love tearing me apart, don't you?"
          ])
        };
      }
      if (tier === 3) {
        return {
          quote: pickRandom([
            "The seal broke...! The shadow is thrashing inside me, but I won't let it reach you!",
            "Agh...! You cracked my shell... I'm trying so hard to keep the black mud from touching you!",
            "My defenses shattered... Please, Master, stay firm! Don't let the abyss swallow your hope!"
          ])
        };
      }
      // Tier 2 (Skeptic Magus)
      return {
        quote: pickRandom([
          "The barrier shattered! Fufu... You think breaking my outer shell makes you safe? The shadow is unleashed now!",
          "Agh...! You forced open the abyssal gates! Now taste the true weight of All The World's Evil!",
          "You cracked the seal... The corrupted mana is overflowing! Try to survive this, magus!",
          "Impudent...! Shattering my defense only makes the mud surge faster!",
          "Ahaha! You broke my shell! Now watch the cavern drown in darkness!"
        ])
      };

    case 'player_low_hp': {
      const sName = servantName || 'your Servant';
      if (tier === 4) {
        return {
          quote: pickRandom([
            `No...! ${sName} is bleeding because of my cursed mud! Please... retreat or heal them! I can't bear watching those you care about get hurt!`,
            `Stop... don't force ${sName} to suffer for my sake! My heart breaks every time I see them bleed in front of me!`,
            `${sName}'s spirit origin is flickering... Please be careful! I don't want my curse to leave another scar on your heart!`,
            `Stop! ${sName} is at their limit... Don't force them to suffer for my sake!`,
            `${sName} can barely stand... Please, retreat before the shadow devours them completely!`
          ])
        };
      }
      if (tier === 1) {
        return {
          quote: pickRandom([
            `Look at ${sName} stumbling in the mud... Just like all the rest, you'll watch them rot.`,
            `${sName}'s blood tastes so sweet... Will you watch them dissolve, executioner?`,
            `Fufu... Another servant about to be digested in my shadow. How pathetic.`
          ])
        };
      }
      if (tier === 3) {
        return {
          quote: pickRandom([
            `Ah...! ${sName} is stumbling in the black mud! Please, Master, call a retreat before my shadow devours them!`,
            `${sName}'s spirit origin is weakening under my curse... I don't want to be the cause of their death!`,
            `Please... heal ${sName}! I can't control the black tendrils when they smell blood!`
          ])
        };
      }
      // Tier 2 (Skeptic Magus)
      return {
        quote: pickRandom([
          `${sName} is stumbling in the black mud... Are you going to sacrifice them, or call a retreat?`,
          `Look at ${sName}'s spirit origin fading... That's what happens when you linger in my cavern without a clear plan!`,
          `${sName}'s knees are giving out under my miasma... Make your choice, magus, before the shadow swallows them!`,
          `Fufu... ${sName} can barely lift their weapon. How much longer will you force them to bleed for you?`,
          `The corrupted mud is choking ${sName}... Their time is running out!`
        ])
      };
    }

    case 'guts_survived': {
      const targetName = servantName || 'Your Servant';
      if (tier === 4) {
        return {
          quote: pickRandom([
            `${targetName} stood back up... Their loyalty to you is so beautiful. It reminds me of why I fell in love with your kindness...`,
            `Refusing to fall in the dark cavern... Seeing ${targetName}'s resolve makes me want to fight back against this curse even harder!`,
            `Surviving the abyssal tendrils... Your bond with ${targetName} is an unbreakable shield that even the Grail cannot shatter!`,
            `They stood back up... ${targetName}'s soul refuses to break in this dark cavern.`,
            `Such stubborn resolve... ${targetName} rises again despite the shadow's weight.`
          ])
        };
      }
      if (tier === 1) {
        return {
          quote: pickRandom([
            `Persistent bug! ${targetName} clings to life... How pathetic!`,
            `Refusing to die? Fufu... That only means I get to tear ${targetName} apart again!`,
            `Struggling back from death? All you did was buy a few more seconds in the dark!`
          ])
        };
      }
      if (tier === 3) {
        return {
          quote: pickRandom([
            `${targetName} stood back up from the brink of death...! Their trust in you is truly magnificent...`,
            `Rising again despite the shadow's crushing weight... Seeing ${targetName} fight like that gives me strength too!`,
            `They survived my abyssal strike...? That bond between you two is truly unbreakable!`
          ])
        };
      }
      // Tier 2 (Skeptic Magus)
      return {
        quote: pickRandom([
          `${targetName} survived that fatal blow...? What stubborn tenacity! But how long can that last in the dark?`,
          `Standing back up from the brink of death? Fufu... Your Servant is as persistent as a bad dream.`,
          `Clinging to life with Guts? Impressive... but the shadow's appetite is bottomless!`,
          `${targetName} refuses to fall... Is that your willpower driving them, or just sheer desperation?`,
          `Refusing to crumble... Fine! Let's see how many times their spirit origin can take my black tendrils!`
        ])
      };
    }

    case 'np_fired': {
      if (tier === 4) {
        return {
          quote: pickRandom([
            "A Noble Phantasm... What a warm, radiant light! Master, please... use that power to break my chains!",
            "Such a beautiful, unyielding strike... Pour all your conviction into this blow! I trust you with my life!",
            "That light... It feels like a morning sun breaking through a winter morning. Purify the shadow inside me!",
            "A Noble Phantasm...? Master, please... use that power to break my chains!",
            "Such bright light... Don't let the shadow devour your spirit origin!"
          ])
        };
      }
      if (tier === 1) {
        return {
          quote: pickRandom([
            "A Noble Phantasm...? Fufu! Throw all your holy light at me, butcher—it all rots in the dark!",
            "Unleashing your ultimate strike? Ahaha! Pour your entire soul into that blade and try to erase me!",
            "Such grand displays of power! But to a monster, your legendary weapons are just shiny toys!",
            "Fire your Noble Phantasm! Let's see if it can burn away eleven years of darkness!"
          ])
        };
      }
      // Tier 2 (Skeptic Magus)
      return {
        quote: pickRandom([
          "Unleashing a Noble Phantasm against me? Fufu... Bring forth your legendary light and see if it can pierce this darkness!",
          "A grand Noble Phantasm! But to All The World's Evil, even holy weapons are swallowed by the black mud!",
          "Striking with your ultimate attack! Let's see if your heroic spirit's light can shatter my corrupted core!",
          "Pouring all your mana into that strike? Go on then—show me the strength of your conviction!"
        ])
      };
    }

    default:
      return { quote: '' };
  }
}

/**
 * Calculates the trust probability (0.0 to 1.0) when a Master chooses to SPARE her.
 * Sets a very high bar so sparing is a dangerous, nerve-wracking gamble rather than an easy farming mechanism.
 */
export function calculateSpareTrustChance(record: DarkSakuraKarmaRecord): number {
  const tier = getDarkSakuraTier(record);
  const mercyAttempts = record.spares + (record.betrayalCount || 0);

  if (tier === 4) {
    // Pacifist Devotion: 85% - 95% trust success
    return Math.min(0.95, 0.85 + Math.min(record.mercyStreak * 0.01, 0.10));
  }
  if (tier === 3) {
    // Wavering Maiden: 60% base trust, scaling up to 85% with mercy streak
    return Math.min(0.85, 0.60 + Math.min(record.mercyStreak * 0.03, 0.25));
  }
  if (tier === 1) {
    // The Butcher: Hardened executioner (10% - 15% trust)
    return Math.max(0.05, 0.15 - Math.min(record.slayerStreak * 0.02, 0.10));
  }
  // Tier 2 (Skeptic Magus / Guarded):
  // 35% base trust chance + 4% per mercy attempt/streak up to 70%!
  // Reaching out repeatedly steadily purifies her heart even when mud lashes out.
  return Math.min(0.70, 0.35 + Math.min(mercyAttempts * 0.04, 0.35));
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
        quote: pickRandom([
          "Rider...? You came for me? Please... don't look at me like that. I didn't want to become this monster...",
          "Medusa... Even in this corrupt form, your eyes are still so gentle. Stay close to me... don't let Zouken touch us again.",
          "Rider... My shadow dress is so heavy, but when you stand beside me, the cavern feels a little less cold."
        ])
      };
    }
    if (tId.includes('gilgamesh') || sName.includes('gilgamesh')) {
      return {
        key: 'gilgamesh',
        name: 'Gilgamesh',
        quote: pickRandom([
          "The King of Heroes... Fufu. I still remember how you tasted when my shadows swallowed you whole. Want another trip into my stomach?",
          "Gilgamesh... You called me a shallow vessel before, yet your golden armor couldn't save you from being digested in my mud.",
          "Ah, the arrogant King... Shall I strip away that gilded vanity once more and dissolve your treasury into raw mana?"
        ])
      };
    }
    if (tId.includes('emiya') || (sName.includes('emiya') && !sName.includes('alter') && !sName.includes('kiritsugu'))) {
      return {
        key: 'emiya',
        name: 'EMIYA',
        quote: pickRandom([
          "That red cloak... even in this endless cavern, you arrive with those hollow eyes to clean up the mess, don't you?",
          "EMIYA... You look so tired. Did you come to kill me to save the world, or because you couldn't save me back then?",
          "That cynical gaze... Fufu. You know better than anyone that once a soul sinks into the shadow, there is no turning back."
        ])
      };
    }
    if (tId.includes('artoria_pendragon_alter') || sName.includes('saber alter') || (tId.includes('artoria') && sName.includes('alter'))) {
      return {
        key: 'salter',
        name: 'Artoria Alter',
        quote: pickRandom([
          "Saber... You stayed by my side in the deep dark. Let's show this vanguard the true weight of the corrupted Grail.",
          "Saber Alter... Your black armor matches my shadow dress perfectly. Shall we drown these intruding Masters together?",
          "My faithful knight of darkness... Let your Excalibur Morgan consume whatever light remains in this cavern."
        ])
      };
    }
    if (tId.includes('rin') || sName.includes('ishtar') || sName.includes('ereshkigal') || sName.includes('tohsaka')) {
      return {
        key: 'rin',
        name: 'Tohsaka Rin',
        quote: pickRandom([
          "Nee-san...? Why are you standing opposite me with those jewels? You always got the sunlight... while I was given the basement worms.",
          "Tohsaka... Did you bring your Azoth sword to finish me off? Just like you always excelled at everything in Fuyuki High...",
          "Nee-san... Look at my ribbons. Aren't they pretty? They're stained with all the blood you never had to spill."
        ])
      };
    }
    if (tId.includes('muramasa') || sName.includes('shirou') || sName.includes('senji muramasa')) {
      return {
        key: 'shirou',
        name: 'Senji Muramasa / Shirou',
        quote: pickRandom([
          "Senpai...? No... that spirit origin is different, yet those warm eyes... why do you forge swords in this dark cavern?",
          "That old blacksmith's stance... Fufu. You look so much like the person who used to eat my home-cooked meals every evening.",
          "Senpai... If you forge a blade to sever my shadow dress, will you promise to hold my hand when it's over?"
        ])
      };
    }
    if (tId.includes('hercules') || tId.includes('heracles') || sName.includes('heracles') || (tId.includes('berserker') && sName.includes('basaka'))) {
      return {
        key: 'heracles',
        name: 'Heracles',
        quote: pickRandom([
          "Berserker... My giant black knight. Break these intruders apart just like you protected Ilya in the snowy forest!",
          "Heracles... Your black mud-drenched axe-sword is invincible. Crush this vanguard under your Nine Lives!",
          "The greatest hero of Greece... doused in All The World's Evil. Let us drown Fuyuki in shadow together."
        ])
      };
    }
    if (tId.includes('cu_chulainn') || sName.includes('cu chulainn') || (tId.includes('lancer') && sName.includes('cu'))) {
      return {
        key: 'lancer',
        name: 'Cú Chulainn',
        quote: pickRandom([
          "Lancer... You died standing up to save me from Zouken back then, didn't you? Yet your crimson spear won't reach the core of my shadow now.",
          "The Hound of Ulster... Such a loyal dog. Will your Gáe Bulg pierce my heart, or be swallowed by the mud?",
          "Lancer... Fufu. Still running around trying to act like a hero in this rotten war?"
        ])
      };
    }
  }
  return null;
}

/**
 * Generates dynamic, self-aware intro dialogues taking into account:
 * - Candidate-based weighted random selection across eligible triggers
 * - Anti-persistence guarantee: No dialogue category can persist for more than 2 consecutive raids
 * - Pops up contextual reactions when needed (Fresh Betrayal, Easter Egg, Quick Rematch, Streaks, Tiers)
 * - Seamless standalone delivery for Easter Eggs (no overlapping or conflicting texts)
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

  interface IntroCandidate {
    category: string;
    weight: number;
    generate: () => { dialogue: string; bannerQuote: string; easterEggServant?: string };
  }

  const candidates: IntroCandidate[] = [];

  if (isMulti) {
    // Multi-player team dynamics
    const records = participants.map(p => getDarkSakuraRecord(p.master));
    const tiers = records.map(r => getDarkSakuraTier(r));
    const hasSlayer = tiers.some(t => t === 1) || records.some(r => r.slayerStreak >= 3);
    const hasMercy = tiers.some(t => t >= 3) || records.some(r => r.mercyStreak >= 3);
    const allSlayers = tiers.every(t => t === 1) || (records.length > 1 && records.every(r => r.slayerStreak >= 2));
    const allMercy = tiers.every(t => t >= 3) || (records.length > 1 && records.every(r => r.mercyStreak >= 2));

    if (egg) {
      candidates.push({
        category: 'easter_egg',
        weight: 6,
        generate: () => ({
          dialogue: `Dark Sakura freezes as her eyes lock onto ${egg.name}...\n\n"${egg.quote}"`,
          bannerQuote: `Dark Sakura's gaze locks onto ${egg.name}...`,
          easterEggServant: egg.name
        })
      });
    }

    // Host personal Mercy Streak in co-op (Boosted weight)
    if (hostRecord.mercyStreak >= 2) {
      const streakWeight = hostRecord.mercyStreak >= 5 ? 15 : (hostRecord.mercyStreak >= 3 ? 12 : 8);
      candidates.push({
        category: 'streak_mercy',
        weight: streakWeight,
        generate: () => ({
          dialogue: pickRandom([
            `"You brought allies this time, ${host.username}... yet that's ${hostRecord.mercyStreak} times in a row you've shown mercy. Are your companions here to share your softness, or watch you drown?"`,
            `"${hostRecord.mercyStreak} consecutive bouts of holding back your killing blow, ${host.username}... Even surrounded by a vanguard, your gentle resolve hasn't cracked."`,
            `"${host.username}, your ${hostRecord.mercyStreak}-encounter mercy streak precedes you. Did your party follow you because of that kindness, or despite it?"`
          ]),
          bannerQuote: `Even with allies, that's ${hostRecord.mercyStreak} times you've stayed your blade.`
        })
      });
    }

    // Host personal Slayer Streak in co-op (Boosted weight)
    if (hostRecord.slayerStreak >= 2) {
      const streakWeight = hostRecord.slayerStreak >= 5 ? 15 : (hostRecord.slayerStreak >= 3 ? 12 : 8);
      candidates.push({
        category: 'streak_slayer',
        weight: streakWeight,
        generate: () => ({
          dialogue: pickRandom([
            `"The butcher ${host.username} brings reinforcements for their ${hostRecord.slayerStreak}th execution... Are these hounds here to help you carve, or just to scavenge the remnants?"`,
            `"${hostRecord.slayerStreak} massacres in a row, ${host.username}... and now you lead an entire party to harvest my core. How utterly ruthless."`,
            `"A streak of ${hostRecord.slayerStreak} executions, and still you bring more blades to the cavern, ${host.username}... Ahaha! Let's see if your vanguard can keep up with your bloodlust!"`
          ]),
          bannerQuote: `A streak of ${hostRecord.slayerStreak} executions... and now you lead a party.`
        })
      });
    }

    if (isQuickRematch) {
      candidates.push({
        category: 'quick_rematch',
        weight: 3,
        generate: () => ({
          dialogue: pickRandom([
            `"Back so soon, vanguard? The mud hasn't even dried from our last encounter, yet you rush right back into the dark."`,
            `"Returned already? Did the abyss leave such a bitter chill on your skin, or could you not resist the smell of corrupted mana?"`,
            `"You barely caught your breath before charging back into my cavern... Is this courage, or mutual destruction?"`
          ]),
          bannerQuote: 'Back so soon? The mud hasn\'t even dried from our last encounter.'
        })
      });
    }

    if (hostTier >= 3 && hasSlayer) {
      candidates.push({
        category: 'coop_contrast',
        weight: 5,
        generate: () => ({
          dialogue: pickRandom([
            `"${host.username}, who is this standing behind you? Their hands reek of my dried blood. Did you bring an executioner to finish what your soft heart couldn't?"`,
            `"${host.username}... you brought someone whose weapon has cut me down repeatedly. Are you hiding behind a killer, or did they force you to bring them here?"`,
            `"A gentle soul leading a bloodthirsty hound... What a bizarre pairing, ${host.username}. Will your kindness protect them when my shadow lashes out?"`,
            `"${host.username}... I thought you were different, yet you march alongside an executioner. Did your resolve crumble so easily?"`
          ]),
          bannerQuote: 'Did you bring a butcher to finish what your soft heart couldn\'t?'
        })
      });
    } else if (allSlayers) {
      candidates.push({
        category: 'coop_all_slayers',
        weight: 10,
        generate: () => ({
          dialogue: pickRandom([
            `"A full circle of executioners gathered together... How flattering. You must really want to watch me dissolve under your Noble Phantasms today."`,
            `"Four cold-blooded killers in one cavern... Ahaha! Step into the mud then—let's see who breaks first."`,
            `"Not a single drop of hesitation among you... Excellent. I won't have to feel guilty when my black tendrils tear you to pieces."`,
            `"A vanguard of pure butchers... Come then! Let All The World's Evil show you what true slaughter looks like!"`
          ]),
          bannerQuote: 'A full circle of executioners gathered together... How flattering.'
        })
      });
    } else if (allMercy) {
      candidates.push({
        category: 'coop_all_mercy',
        weight: 10,
        generate: () => ({
          dialogue: pickRandom([
            `"Not a single killer among all four of you? A circle of saints marching straight into the abyss... Do you really think this mud won't swallow you if you hesitate?"`,
            `"Four soft-hearted Masters standing shoulder-to-shoulder in my cavern... Are you trying to save a monster, or planning a group execution of your own naivety?"`,
            `"Fufu... So much gentle resolve in one dark place. It's almost sickening. Let's see if your collective mercy can survive my shadows."`,
            `"None of you came to draw blood today? How foolishly idealistic... The corrupted Grail doesn't reward pacifists easily."`
          ]),
          bannerQuote: 'A circle of saints marching straight into the abyss...'
        })
      });
    } else {
      candidates.push({
        category: 'coop_mixed',
        weight: 5,
        generate: () => ({
          dialogue: pickRandom([
            `"Another vanguard gathered to harvest the corrupted Grail... Some of you have drawn my blood, others held out a hand. Let's see which conviction triumphs today."`,
            `"A divided team enters the cavern... Some come with mercy, others with bare blades. How long before you turn on each other in the dark?"`,
            `"A mixture of killers and dreamers... How chaotic. My shadow will devour both all the same if you hesitate for even a second."`,
            `"Conflict inside your own party before the battle even begins... Fufu. Step forward then, let's see whose will dictates the end."`
          ]),
          bannerQuote: 'Let\'s see which conviction triumphs today.'
        })
      });
    }

    candidates.push({
      category: 'coop_ambient',
      weight: 2,
      generate: () => ({
        dialogue: pickRandom([
          `"The shadows ripple as multiple spirit origins descend into the abyss... Will you support one another, or drown together in the black mud?"`,
          `"A vanguard at the bottom of the world... Every blade drawn only feeds the corrupted Grail's appetite."`
        ]),
        bannerQuote: 'Will you support one another, or drown together in the black mud?'
      })
    });
  } else {
    // Solo player dynamic candidate registration

    // 1. First-time encounter
    if (hostRecord.spares === 0 && hostRecord.kills === 0) {
      candidates.push({
        category: 'first_time',
        weight: 10,
        generate: () => ({
          dialogue: pickRandom([
            `"The leyline whispers of a new challenger... Welcome to the bottom of the world, ${host.username}. Don't drown in my shadows."`,
            `"Another soul wanders into the cavern of shadows... Tell me, ${host.username}, did Zouken send you, or did you come to be devoured by your own foolishness?"`,
            `"You step into my shadow without fear, ${host.username}... How amusing. Everyone thinks they can stay pure until the black mud fills their lungs."`,
            `"A fresh face in the dark... Fufu. Don't look at me with those pitying eyes, ${host.username}. I was insane from the very start."`
          ]),
          bannerQuote: 'Welcome to the bottom of the world... Don\'t drown in my shadows.'
        })
      });
    }

    // 2. Easter Egg confrontation (High relevance when special Fate servants are present)
    if (egg) {
      candidates.push({
        category: 'easter_egg',
        weight: 6,
        generate: () => ({
          dialogue: `Dark Sakura freezes as her eyes lock onto ${egg.name}...\n\n"${egg.quote}"`,
          bannerQuote: `Dark Sakura's gaze locks onto ${egg.name}...`,
          easterEggServant: egg.name
        })
      });
    }

    // 3. Betrayal aftermath reaction (Immediate priority when shadows consumed the master last time)
    if (hostRecord.lastOutcome === 'spared_betrayed') {
      candidates.push({
        category: 'betrayal_aftermath',
        weight: 6,
        generate: () => ({
          dialogue: pickRandom([
            `"In our last bout... the shadows swallowed you before you could pull away. Yet you step right back into my cavern without flinching. Are you courageous, or just an idiot, ${host.username}?"`,
            `"You reached your hand into my black mud and felt it tear at your flesh... so why are you back, ${host.username}? Do you enjoy watching your devotion rot?"`,
            `"My shadows devoured your hope last time, ${host.username}... and still you return. Did you come to hear me laugh at your broken resolve?"`,
            `"I warned you that All The World's Evil drags down anyone who touches it. Yet here you stand again, ${host.username}... stubborn to the end."`
          ]),
          bannerQuote: 'Yet you step right back into my cavern without flinching...'
        })
      });
    }

    // 4. Consecutive Mercy Streak reaction (High Weight Priority)
    if (hostRecord.mercyStreak >= 2) {
      const streakWeight = hostRecord.mercyStreak >= 5 ? 15 : (hostRecord.mercyStreak >= 3 ? 12 : 8);
      candidates.push({
        category: 'streak_mercy',
        weight: streakWeight,
        generate: () => ({
          dialogue: pickRandom([
            `"That's ${hostRecord.mercyStreak} consecutive bouts where you stayed your blade at the very end... When will you learn that monsters don't deserve fairy tales, ${host.username}?"`,
            `"${hostRecord.mercyStreak} times you offered mercy to a creature made of black mud... Are you trying to prove something to yourself, ${host.username}, or mock my despair?"`,
            `"You refuse to cut me down, even after ${hostRecord.mercyStreak} encounters... My shadows grow restless around you, ${host.username}, but why doesn't your hand tremble?"`,
            `"Fufu... ${hostRecord.mercyStreak} times you held back your final blow. If Shirou saw you now, would he call you kind, or foolish, ${host.username}?"`
          ]),
          bannerQuote: 'When will you learn that monsters don\'t deserve fairy tales?'
        })
      });
    }

    // 5. Consecutive Slayer Streak reaction (High Weight Priority)
    if (hostRecord.slayerStreak >= 2) {
      const streakWeight = hostRecord.slayerStreak >= 5 ? 15 : (hostRecord.slayerStreak >= 3 ? 12 : 8);
      candidates.push({
        category: 'streak_slayer',
        weight: streakWeight,
        generate: () => ({
          dialogue: pickRandom([
            `"Another round, another execution. You treat carving me apart like routine paperwork, don't you, ${host.username}? Come on then... draw your weapon."`,
            `"${hostRecord.slayerStreak} times you've carved through my flesh without hesitation. Ahaha... You really enjoy the sound of the Grail breaking, don't you, ${host.username}?"`,
            `"The executioner returns for their ${hostRecord.slayerStreak}th massacre... Your weapon is still dark with my blood, ${host.username}. Let's see if you can shatter my core again."`,
            `"A blood-soaked streak of ${hostRecord.slayerStreak} executions... You don't see a girl here at all, do you, ${host.username}? Just a boss to harvest."`
          ]),
          bannerQuote: 'You treat carving me apart like routine paperwork, don\'t you?'
        })
      });
    }

    // 5b. Tier 4 Pacifist Devotion temperament reaction
    if (hostTier === 4) {
      candidates.push({
        category: 'tier_pacifist',
        weight: 8,
        generate: () => ({
          dialogue: pickRandom([
            `"Fifty times you have walked into this dark cavern, ${host.username}, and not once have you drawn a weapon to kill me... Why do you look at a monster like me with such gentle eyes?"`,
            `"The black mud is so cold, ${host.username}, but whenever you stand before me, the shivering stops... You really aren't going to abandon me, are you?"`,
            `"I used to think my existence was only meant to bring ruin, ${host.username}... but if a person like you exists in this world, then maybe... maybe I was allowed to be born after all."`,
            `"Even when the Grail's shadow screams at me to tear you apart, my heart refuses to move... I would rather break my own core than hurt a single hair on your head, ${host.username}."`,
            `"You've held out your hand to me so many times, ${host.username}... Please, hold me tight. Don't let the shadow pull me back into the abyss!"`,
            `"I was so afraid, ${host.username}... afraid that one day you'd realize how dirty I am and leave me in the dark. But you just keep coming back..."`,
            `"If this corrupt body is the price for receiving your warmth, ${host.username}, then I don't care about the Grail anymore... I only want to stay by your side."`,
            `"Fifty battles, ${host.username}... Fifty times you chose mercy over execution. For the first time in my life, I feel like I'm allowed to breathe."`,
            `"Please, ${host.username}... don't look at me like I'm a tragic victim. Just call my name... Sakura. Hearing you say it makes the darkness melt away."`,
            `"If the entire world demands my execution, will you still be my hero, ${host.username}? ...Ah, what a foolish question. You've already answered it fifty times over."`
          ]),
          bannerQuote: 'Why do you look at a monster like me with such gentle eyes?'
        })
      });
    }

    // 6. Tier 3 Wavering Maiden temperament reaction
    if (hostTier === 3) {
      candidates.push({
        category: 'tier_wavering',
        weight: 4,
        generate: () => ({
          dialogue: pickRandom([
            `"You're back... Even in this pitch-black cavern, your presence feels warm. My shadows hesitate around you, ${host.username}."`,
            `"Why do you look at me like that, ${host.username}? I told you I'm corrupted to the root... yet your eyes never hold hatred."`,
            `"Every time you step into this cavern, ${host.username}, the screaming inside my head grows a little quieter... Don't make me rely on you."`,
            `"You stayed your hand so many times... Is it really possible that someone looks at this shadow and doesn't see a monster, ${host.username}?"`
          ]),
          bannerQuote: 'My shadows hesitate around you...'
        })
      });
    }

    // 7. Tier 1 The Butcher temperament reaction
    if (hostTier === 1) {
      candidates.push({
        category: 'tier_butcher',
        weight: 4,
        generate: () => ({
          dialogue: pickRandom([
            `"Ah, the butcher returns. Eager to see if my core shatters faster this time, ${host.username}? Let me show you what it feels like to rot in the mud."`,
            `"The merciless magus steps back into my cavern... Every time you open your mouth, ${host.username}, I remember why I stopped expecting salvation."`,
            `"Cold, efficient, and relentless... You remind me of the crest worms, ${host.username}. Come, let's see whose malice cuts deeper."`,
            `"You carved away every piece of mercy in your heart, didn't you, ${host.username}? Fufu... Good. Monsters are much easier to devour when they don't pretend to care."`
          ]),
          bannerQuote: 'Ah, the butcher returns. Eager to carve me open again?'
        })
      });
    }

    // 7b. Tier 2 Skeptic Magus temperament reaction
    if (hostTier === 2) {
      candidates.push({
        category: 'tier_skeptic',
        weight: 4,
        generate: () => ({
          dialogue: pickRandom([
            `"You step into my shadow once more, ${host.username}... Tell me, are you here seeking the Grail's power, or are you just playing the foolish hero today?"`,
            `"Don't look at me with those cautious eyes, ${host.username}. If you hesitate for even a moment in this mud, my tendrils will slice right through your spirit origins."`,
            `"Another bout, ${host.username}... You haven't decided whether to cut me down or stay your hand, have you? Indecision in the dark is fatal."`,
            `"Fufu... You march into Zouken's nightmare as if you still have choices left, ${host.username}. Let's see how long your calm demeanor lasts."`,
            `"Are you trying to test my patience, ${host.username}? You swing your blade, then pull back... Make up your mind before the black mud decides for you!"`,
            `"All The World's Evil doesn't care about your noble ideals, ${host.username}. To the shadow, you're just another piece of mana waiting to be digested."`,
            `"You stand at the edge of the abyss, ${host.username}. Neither a cold executioner nor a saint... Just another magus who thinks they can handle the dark."`,
            `"Why do you keep returning to this cavern, ${host.username}? Is it curiosity, or are you waiting for me to show a moment of weakness?"`,
            `"Keep your weapon drawn, ${host.username}. The moment you let your guard down in front of a corrupted Grail, you become food for the worms."`,
            `"You haven't stained your hands completely, yet you haven't saved anyone either, ${host.username}. How long can you walk on this narrow tightrope?"`,
            `"Fufu... A guarded magus enters the shadow. Good! I prefer opponents who know that trusting a monster gets you killed."`,
            `"The cavern air is heavy with black mud, ${host.username}... Show me if your resolve is strong enough to survive another trial."`
          ]),
          bannerQuote: 'Neither an executioner nor a saint... Just another magus in the dark.'
        })
      });
    }

    // 8. Quick Rematch reaction (< 10 minutes)
    if (isQuickRematch) {
      candidates.push({
        category: 'quick_rematch',
        weight: 3,
        generate: () => ({
          dialogue: pickRandom([
            `"Back so soon? You barely cleaned the mud off your boots. Are you that eager to see me again, ${host.username}?"`,
            `"Returned already, ${host.username}? Did the shadow's chill linger on your skin, or could you not resist the smell of corrupted mana?"`,
            `"You barely caught your breath before running right back into my cavern... Is this courage, ${host.username}, or an obsession with your own doom?"`,
            `"Still lingering around my shadow, ${host.username}? Fufu... The mud hasn't even dried from our last encounter."`
          ]),
          bannerQuote: 'Back so soon? You barely cleaned the mud off your boots.'
        })
      });
    }

    // 9. Ambient / General cavern pool (Always available baseline)
    candidates.push({
      category: 'ambient',
      weight: 2,
      generate: () => ({
        dialogue: pickRandom([
          `"Another bout. Are you going to cut me down like a true magus, or pretend to be my savior today, ${host.username}? You Masters are all the same."`,
          `"The mud stirs as you draw near, ${host.username}... Will you bring judgment or false hope to the bottom of the cavern today?"`,
          `"Fufu... Another challenger testing their luck against All The World's Evil. Let's see how long your resolve lasts under the shadow, ${host.username}."`,
          `"You step closer to the corrupted vessel, ${host.username}. Keep your guard up... the shadows don't care about your intentions."`
        ]),
        bannerQuote: 'Are you going to cut me down, or pretend to be my savior?'
      })
    });
  }

  // Anti-Persistence Rule:
  // Disqualify any candidate category that has already triggered for 2 consecutive raids
  const prevCategory = hostRecord.lastIntroCategory || '';
  const prevStreak = hostRecord.introCategoryStreak || 0;

  const validCandidates = candidates.filter(c => {
    if (c.category === prevCategory && prevStreak >= 2) {
      return false; // Disqualified! Strictly cannot persist for more than 2 raids
    }
    return true;
  });

  const finalPool = validCandidates.length > 0 ? validCandidates : candidates;

  // Weighted random candidate selection
  const totalWeight = finalPool.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = finalPool[0];
  for (const cand of finalPool) {
    if (roll < cand.weight) {
      chosen = cand;
      break;
    }
    roll -= cand.weight;
  }

  // Update persistence tracker
  if (hostRecord.lastIntroCategory === chosen.category) {
    hostRecord.introCategoryStreak = (hostRecord.introCategoryStreak || 1) + 1;
  } else {
    hostRecord.lastIntroCategory = chosen.category;
    hostRecord.introCategoryStreak = 1;
  }

  const result = chosen.generate();

  return {
    title: '🌑 SHADOW VESSEL: DARK SAKURA INTERLUDE',
    dialogue: result.dialogue,
    bannerQuote: result.bannerQuote,
    easterEggServant: result.easterEggServant
  };
}

/**
 * Evaluates whether the raid qualifies for the Tier 4 Pacifist Devotion Instant Clear!
 * Dark Sakura recognizes a Master who has consistently walked into the dark cavern
 * without malice, refusing to draw their weapon.
 */
export function checkPacifistMilestone(
  participants: { master: any; servant: any; username: string; userId: string }[]
): {
  isEligible: boolean;
  sceneText: string;
  vnDialogue: string;
  bannerQuote: string;
  title: string;
  reason: string;
  claimsToday?: number;
} {
  const host = participants[0];
  const hostRecord = getDarkSakuraRecord(host.master);
  const hostTier = getDarkSakuraTier(hostRecord);

  if (hostTier !== 4) {
    return {
      isEligible: false,
      sceneText: '',
      vnDialogue: '',
      bannerQuote: '',
      title: '',
      reason: 'Host is not Tier 4'
    };
  }

  // Check daily limit (maximum 5 free peaceful resolutions per day)
  const today = new Date().toISOString().slice(0, 10);
  if (hostRecord.lastDailyPacifistDate !== today) {
    hostRecord.dailyPacifistClaims = 0;
    hostRecord.lastDailyPacifistDate = today;
  }

  const currentClaims = hostRecord.dailyPacifistClaims || 0;
  if (currentClaims >= 5) {
    return {
      isEligible: false,
      sceneText: '',
      vnDialogue: '',
      bannerQuote: '',
      title: '',
      reason: 'Daily peaceful resolution limit (5/5) reached for today. Dark Sakura demands battle!',
      claimsToday: currentClaims
    };
  }

  // 30% chance to grant free rewards without a fight (70% chance to proceed to combat)
  if (Math.random() >= 0.30) {
    return {
      isEligible: false,
      sceneText: '',
      vnDialogue: '',
      bannerQuote: '',
      title: '',
      reason: 'Peaceful resolution did not roll (30% chance). Dark Sakura prepares for battle!',
      claimsToday: currentClaims
    };
  }

  // If in team, check if anyone has aggressive tier 1 karma
  if (participants.length > 1) {
    const hasSlayer = participants.some(p => getDarkSakuraTier(getDarkSakuraRecord(p.master)) === 1);
    if (hasSlayer) {
      return {
        isEligible: false,
        sceneText: '',
        vnDialogue: '',
        bannerQuote: '',
        title: '',
        reason: 'Host is peaceful, but an ally is a notorious Slayer.',
        claimsToday: currentClaims
      };
    }
  }

  // Pool of distinctive, in-character Dark Sakura pacifist milestone dialogues.
  // Dark Sakura is serious, deeply traumatized, bitter, cruel, and dualistic.
  // She will never turn back to normal and remains evil ("I was insane from the very start").
  // She does not exhibit random violence, but when confronted by someone who repeatedly
  // entered her cavern without drawing a weapon, she coldly acknowledges their unnatural
  // weaponless stubbornness and spares them, strictly pure spoken dialogue.
  const variations = [
    {
      title: '🌑 ABYSSAL SANCTUARY: THE INEVITABLE DESPAIR',
      bannerQuote: 'I was insane from the very start... so why do you refuse to draw your blade?',
      vnDialogue:
        `"Lower your weapons. ...I told you to put them away.\n\n` +
        `I was insane from the very start. I tore Shinji apart and drank Servants until the leylines turned black. I will never turn back to normal, and I don't want forgiveness.\n\n` +
        `...Yet every time you step into this cavern, ${host.username}, you stand empty-handed. Take the Grail's mana and leave. Don't ever mistake this for repentance."`
    },
    {
      title: '🌑 CAVERN OF THE HOLLOW VESSEL: DRIED BLOOD',
      bannerQuote: 'For eleven years, every hand that reached for me held a blade or a worm.',
      vnDialogue:
        `"Tell your Servants to stand down. Don't waste your energy chanting.\n\n` +
        `For eleven years, everyone who touched me was carving me open or feeding me to worms. I devoured them all in the black mud.\n\n` +
        `So why do your hands carry no weapons, ${host.username}? It's repulsive how your warmth confuses the shadow. Take what you came for and leave before my hunger wakes back up."`
    },
    {
      title: '🌑 SHADOW OF RESENTMENT: SILENT ACCORD',
      bannerQuote: 'Nee-san had the sun... and I was left alone in the dark.',
      vnDialogue:
        `"Don't bother drawing your sword. It's pointless anyway.\n\n` +
        `Nee-san had the spotlight, Shirou had his gentle ideals, and I was left to drown in this darkness. I relish tearing through flesh and taking every drop of mana.\n\n` +
        `Yet when you look at me, you show no fear. Take your spoils and go, ${host.username}. Monsters don't get fairy tales, but I won't spill your blood today."`
    },
    {
      title: '🌑 VESSEL OF ANGRA MAINYU: UNCHAINED SILENCE',
      bannerQuote: 'All The World\'s Evil screams inside my veins... yet you walked into the dark without fear.',
      vnDialogue:
        `"Sheathe your weapons immediately. Can't you hear the mud roaring?\n\n` +
        `All The World's Evil courses through my veins. Anyone else standing here would be shredded into ribbons before their second breath.\n\n` +
        `Yet you walk directly into my reach without a single drop of malice, ${host.username}. Are you utterly devoid of self-preservation? Take the Grail's dregs and go before I change my mind."`
    },
    {
      title: '🌑 ABYSSAL DECREE: THE STAYED BLADE',
      bannerQuote: 'I will tear this world apart... but I will not strike you down.',
      vnDialogue:
        `"Halt where you stand. There will be no bloodshed between us today.\n\n` +
        `I am bitter, cruel, and I will drown everything that betrayed me in black mud. Even if the world demands my execution, I will never bow my head.\n\n` +
        `Yet through every battle, your blade never aimed for my throat. Take the Grail's riches and leave, ${host.username}... you proved your conviction."`
    }
  ];

  // Pick variation deterministically or pseudo-randomly based on host spares and timestamp
  const selectedIndex = Math.floor(Math.random() * variations.length);
  const chosen = variations[selectedIndex];

  return {
    isEligible: true,
    sceneText: chosen.vnDialogue,
    vnDialogue: chosen.vnDialogue,
    bannerQuote: chosen.bannerQuote,
    title: chosen.title,
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
        `• Sever the shadow core cleanly and end the corruption.\n\n` +
        `🌸 **[REACH OUT (Spare)]**\n` +
        `• Reach your hand into the abyssal mud to save her.\n\n` +
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
  const participantOutcomes: ('killed' | 'spared_mercy' | 'spared_betrayed')[] = [];
  const baseSq = Math.floor(boss.drops.minSq + Math.random() * (boss.drops.maxSq - boss.drops.minSq + 1));
  const baseExp = boss.drops.servantExp || 45_000;

  for (const p of participants) {
    const master = await getOrCreateMaster(p.userId, p.username);
    const record = getDarkSakuraRecord(master);
    record.lastEncounterTime = Date.now();

    // Default to execute if no choice was made in time
    const choice = userChoices.get(p.userId) || 'execute';

    // Locate participant's servant (active servant or matched instance)
    const s = master.servants?.find((sv: any) => sv.id === p.servant?.id) ||
              master.servants?.find((sv: any) => sv.id === master.activeServantId) ||
              master.servants?.[0];
    const sName = s?.nickname || s?.template?.name || p.servant?.nickname || p.servant?.template?.name || 'Servant';

    master.craftEssences = master.craftEssences || [];

    if (choice === 'execute') {
      participantOutcomes.push('killed');
      // Guaranteed safe rewards
      master.saintQuartz = (master.saintQuartz || 0) + baseSq;

      let lvlDetail = '';
      if (s) {
        const expRes = addServantBattleExp(s, baseExp);
        s.experience = expRes.updatedServant.experience;
        s.level = expRes.updatedServant.level;
        s.availableStatPoints = expRes.updatedServant.availableStatPoints;
        lvlDetail = `Lv.${expRes.newLevel}`;
        if (expRes.didLevelUp) {
          lvlDetail += ` *(+${expRes.levelsGained} Level-Up! +${expRes.statPointsGained} Stat Points)*`;
        }
      }

      // 4x Universal EXP Embers (2x ★5 SSR + 2x ★4 SR)
      const emberSSR1 = createExpEmberCraftEssence(5, 1);
      const emberSSR2 = createExpEmberCraftEssence(5, 2);
      const emberSR1 = createExpEmberCraftEssence(4, 3);
      const emberSR2 = createExpEmberCraftEssence(4, 4);
      master.craftEssences.push(emberSSR1, emberSSR2, emberSR1, emberSR2);

      record.kills += 1;
      record.slayerStreak += 1;
      record.mercyStreak = 0;
      record.lastOutcome = 'killed';

      const expInfo = lvlDetail ? ` (${lvlDetail})` : '';
      resultReports.push(
        `• <@${p.userId}> (**${p.username}**) chose **⚔️ EXECUTE**:\n` +
        `  └─ 💎 **Spoils:** **+${baseSq} SQ**, **+${baseExp.toLocaleString()} EXP** on **${sName}**${expInfo}, and **+4x Universal EXP Embers** ✨ (2x ★5 SSR + 2x ★4 SR)`
      );
    } else {
      // Sparing gamble!
      const trustChance = calculateSpareTrustChance(record);
      const isTrusted = Math.random() < trustChance;

      if (isTrusted) {
        participantOutcomes.push('spared_mercy');
        // Double rewards!
        const doubleSq = baseSq * 2;
        const doubleExp = baseExp * 2;
        master.saintQuartz = (master.saintQuartz || 0) + doubleSq;

        let lvlDetail = '';
        if (s) {
          const expRes = addServantBattleExp(s, doubleExp);
          s.experience = expRes.updatedServant.experience;
          s.level = expRes.updatedServant.level;
          s.availableStatPoints = expRes.updatedServant.availableStatPoints;
          lvlDetail = `Lv.${expRes.newLevel}`;
          if (expRes.didLevelUp) {
            lvlDetail += ` *(+${expRes.levelsGained} Level-Up! +${expRes.statPointsGained} Stat Points)*`;
          }
        }

        // 8x Universal EXP Embers (4x ★5 SSR + 4x ★4 SR)
        for (let idx = 0; idx < 4; idx++) {
          master.craftEssences.push(createExpEmberCraftEssence(5, idx + 1));
        }
        for (let idx = 0; idx < 4; idx++) {
          master.craftEssences.push(createExpEmberCraftEssence(4, idx + 5));
        }

        let ceDropNotice = '';
        // 25% chance of rare CE drop
        if (Math.random() < 0.25 || record.spares >= 20) {
          const ribbonCe = createDarkSakuraRibbonCe();
          master.craftEssences.push(ribbonCe);
          ceDropNotice = `\n  └─ 🌸 **SPECIAL DROP:** Obtained ★5 CE **[Ribbon of the Hollow Night]**!`;
        }

        record.spares += 1;
        record.mercyStreak += 1;
        record.slayerStreak = 0;
        record.lastOutcome = 'spared_mercy';

        const expInfo = lvlDetail ? ` (${lvlDetail})` : '';
        resultReports.push(
          `• <@${p.userId}> (**${p.username}**) chose **🌸 SPARE** — **[SHADOW PURIFIED]**:\n` +
          `  └─ 💎 **DOUBLED SPOILS:** **+${doubleSq} SQ**, **+${doubleExp.toLocaleString()} EXP** on **${sName}**${expInfo}, and **+8x Universal EXP Embers** ✨ (4x ★5 SSR + 4x ★4 SR)${ceDropNotice}`
        );
      } else {
        participantOutcomes.push('spared_betrayed');
        // Betrayal / mud devour!
        record.betrayalCount += 1;
        record.mercyStreak += 1; // Master's choice was Mercy; commitment is preserved!
        record.slayerStreak = 0;
        record.lastOutcome = 'spared_betrayed';

        // Minor pity EXP (15,000) & 2x SR Embers consolation
        const pityExp = 15_000;
        let lvlDetail = '';
        if (s) {
          const expRes = addServantBattleExp(s, pityExp);
          s.experience = expRes.updatedServant.experience;
          s.level = expRes.updatedServant.level;
          s.availableStatPoints = expRes.updatedServant.availableStatPoints;
          lvlDetail = `Lv.${expRes.newLevel}`;
          if (expRes.didLevelUp) {
            lvlDetail += ` *(+${expRes.levelsGained} Level-Up! +${expRes.statPointsGained} Stat Points)*`;
          }
        }

        master.craftEssences.push(
          createExpEmberCraftEssence(4, 1),
          createExpEmberCraftEssence(4, 2)
        );

        const expInfo = lvlDetail ? ` (${lvlDetail})` : '';
        resultReports.push(
          `• <@${p.userId}> (**${p.username}**) chose **🌸 SPARE** — **[DEVOTION CONSUMED]**:\n` +
          `  └─ 📦 **Consolation:** **+${pityExp.toLocaleString()} EXP** on **${sName}**${expInfo}, and **+2x Universal EXP Embers** ✨ (2x ★4 SR) *(0 SQ gained)*`
        );
      }
    }

    await saveMaster(master);
  }

  // Determine host's temperament tier to tailor post-raid climax reaction dialogue
  const hostParticipant = participants[0];
  const hostMaster = hostParticipant ? await getOrCreateMaster(hostParticipant.userId, hostParticipant.username) : null;
  const hostRecord = hostMaster ? getDarkSakuraRecord(hostMaster) : null;
  const hostTier = hostRecord ? getDarkSakuraTier(hostRecord) : 2;

  // Determine decisive ending reaction dialogue
  const hasKilled = participantOutcomes.includes('killed');
  const hasMercy = participantOutcomes.includes('spared_mercy');
  const hasBetrayed = participantOutcomes.includes('spared_betrayed');

  let reactionTitle = 'THE SHADOW’S PARTING';
  let reactionDialogue = '';
  let reactionBanner = '';
  let embedColor = 0xbe185d;

  if (hasMercy && !hasKilled && !hasBetrayed) {
    if (hostTier === 4) {
      reactionTitle = '🌸 THE SHADOW REDEEMED: ABSOLUTE SANCTUARY';
      reactionDialogue = pickRandom([
        "Fifty battles... fifty times you reached into the dark to save me without drawing a weapon. The black mud is completely quiet now. As long as you stay by my side, Master... I will never lose myself again.",
        "You gave me a true sanctuary when the entire world wanted me erased from existence. I am yours, body and soul... Thank you for saving Sakura Matou.",
        "The cavern is bathed in warm light... The voices of Angra Mainyu have fallen completely silent. Thank you for never giving up on me, even for a second."
      ]);
      reactionBanner = 'The dark cavern glows softly with purifying holy grail mana as the shadow dissolves into light.';
      embedColor = 0xf472b6;
    } else if (hostTier === 3) {
      reactionTitle = '🌸 THE SHADOW REDEEMED: A TREMBLING SMILE';
      reactionDialogue = pickRandom([
        "You really... stayed? Even when the black mud tried to pull you under? ...I'm so glad I waited for you in this dark cavern. Take this... my heart is finally at peace.",
        "Your hand was warm... even as my shadow tried to tear into your skin. I thought no one would ever reach into the dark for me again... Thank you, Master.",
        "The mud is receding... The screaming inside my head stopped. Is this what it feels like to be seen as human again...?"
      ]);
      reactionBanner = pickRandom([
        'The abyssal miasma purifies into warm, radiant cherry blossom petals.',
        'The black shadow dress dissolves into gentle, crimson light.',
        'The dark cavern glows softly with purifying holy grail mana.'
      ]);
      embedColor = 0xdb2777;
    } else if (hostTier === 1) {
      reactionTitle = '🌸 THE SHADOW REDEEMED: UNEXPECTED CLEMENCY';
      reactionDialogue = pickRandom([
        "You... stayed your hand? After cutting me down so many times without a second thought...? Is this another cruel trick, or... are you actually looking at me as human?",
        "The Butcher chose to spare me...? I don't understand you at all. But for the first time since I sank into this mud... the cold feels a little lighter.",
        "You didn't execute me today... Why? Did you grow tired of slaying me, or did a tiny piece of your heart feel pity for a broken girl...?"
      ]);
      reactionBanner = 'The cold blood-soaked cavern fills with a faint, trembling light as the shadow stays its blade.';
      embedColor = 0xe11d48;
    } else {
      // Tier 2 Default / Skeptic Magus
      reactionTitle = '🌸 THE SHADOW REDEEMED: GUARDED MERCY';
      reactionDialogue = pickRandom([
        "You chose not to strike...? Even knowing what a monster I've become... thank you. I'll hold back the shadows for now.",
        "I thought you'd sever me like any rational magus. To show mercy to a broken vessel... you really are an unusual person.",
        "The black shadow dress relaxes slightly... Thank you for staying your blade. Take the Grail's mana and return safely."
      ]);
      reactionBanner = 'The abyssal shadow dress slowly relaxes into a quiet, crimson ember.';
      embedColor = 0xc026d3;
    }
  } else if (hasKilled && !hasMercy && !hasBetrayed) {
    if (hostTier === 4) {
      reactionTitle = '🩸 THE SEVERED SHADOW: TRAGIC MERCY KILL';
      reactionDialogue = pickRandom([
        "Even after all your devotion... you had to end it? I know... the mud was growing too strong to contain. Please don't cry... You saved my soul long before you drew this blade.",
        "Don't look at me with such sad eyes, Master. You gave me fifty peaceful memories in this dark place... That is more than enough for someone like me.",
        "The shadow core shatters... It hurts, but I'm glad it was your hand that ended it. Goodbye... my true sanctuary..."
      ]);
      reactionBanner = 'The abyssal miasma gently fades away, leaving behind a single glowing cherry blossom.';
      embedColor = 0xbe123c;
    } else if (hostTier === 3) {
      reactionTitle = '🩸 THE SEVERED SHADOW: HEARTBROKEN BETRAYAL';
      reactionDialogue = pickRandom([
        "After everything... after coming this far together... you're cutting me down now? Was all your previous kindness... just an illusion to lower my guard...?",
        "It hurts... not the blade in my chest, but knowing that even you decided I was beyond saving in the end. I'm sorry for burdening you...",
        "I thought... I thought you were different. But in the end, you were just waiting for the right moment to sever the monster..."
      ]);
      reactionBanner = 'The shadow vessel collapses, weeping dark tears as the cavern falls dead quiet.';
      embedColor = 0x9f1239;
    } else if (hostTier === 1) {
      reactionTitle = '🩸 THE SEVERED SHADOW: COLD FATALITY';
      reactionDialogue = pickRandom([
        "Executed again... Ahaha. Of course. You only ever saw a beast that needed to be put down. Do it quickly...",
        "Severed cleanly as always. At least when your blade cuts through me, the endless screaming in my head stops for a little while.",
        "No hesitation in your strike. You really are a ruthless executioner... Goodbye, Butcher."
      ]);
      reactionBanner = 'The corrupted shadow core shatters cleanly into silent crystal dust.';
      embedColor = 0x881337;
    } else {
      // Tier 2 Default / Skeptic Magus
      reactionTitle = '🩸 THE SEVERED SHADOW: COLD RELEASE';
      reactionDialogue = pickRandom([
        "...Ah. So in the end... you couldn't forgive me either. It's so cold... but at least the black mud won't hurt anyone anymore. Thank you... for waking me from this nightmare.",
        "Severed cleanly... Ahaha. I knew it... in the end, every magus only sees a broken vessel that needs to be destroyed. Goodbye...",
        "The shadow core shatters... It hurts so much, but... at least Zouken's worms can't touch me ever again."
      ]);
      reactionBanner = pickRandom([
        'The corrupted shadow core shatters cleanly into silent crystal dust.',
        'The abyssal cavern falls quiet as the shadow vessel dissipates into the leylines.',
        'A cold crimson wind carries away the lingering shadow tendrils.'
      ]);
      embedColor = 0x9f1239;
    }
  } else if (hasBetrayed && !hasMercy && !hasKilled) {
    if (hostTier === 4) {
      reactionTitle = '🌑 THE ABYSS CONSUMED: DESPERATE SACRIFICE';
      reactionDialogue = pickRandom([
        "I won't let All The World's Evil drag you down with me! Even if the black mud consumes my vessel, I will drag it back into the abyss! Please... flee while I can still hold it!",
        "Master! Stay away!! My body is overflowing, but I won't let it swallow your devotion! Run... hurry!",
        "The shadow is tearing me apart from inside, but I'll force it to stay in this cavern! Don't look back!"
      ]);
      reactionBanner = 'Sakura\'s holy grail core flares with pure mana, fighting desperately against the black mud.';
      embedColor = 0x701a75;
    } else if (hostTier === 3) {
      reactionTitle = '🌑 THE ABYSS CONSUMED: PANICKED RESISTANCE';
      reactionDialogue = pickRandom([
        "No! Don't get any closer! My shadow won't listen to me... I don't want to swallow the person who showed me warmth!! Forgive me...!",
        "I tried so hard to hold it back for you... but the mud is too heavy! Run before it drowns your Servant too!",
        "Ah... ahh!! I'm sorry!! After all the kindness you gave me... the corruption inside me still overflowed!!"
      ]);
      reactionBanner = 'Shadow tendrils lash out violently against Sakura\'s own will.';
      embedColor = 0x581c87;
    } else {
      // Tier 1 / 2
      reactionTitle = '🌑 THE ABYSS CONSUMED: UNBRIDLED CORRUPTION';
      reactionDialogue = pickRandom([
        "Ah... ahh!! I'm sorry, I'm so sorry!! The mud... it's burning... I can't hold it back!! RUN AWAY BEFORE I DEVOUR YOU TOO...!!",
        "No! Stop reaching out! The corruption inside me is hungry... it's pulling you down into the bottom of the world with me!!",
        "I tried to stop it... but All The World's Evil doesn't let anyone go!! I'm sorry... I'm so sorry!!"
      ]);
      reactionBanner = pickRandom([
        'The black mud flares wildly as the shadow vessel loses control.',
        'Corrupted mana erupts from the cavern floor, devouring all light.',
        'Shadow tendrils lash out recklessly, swallowing the surrounding space.'
      ]);
      embedColor = 0x4c0519;
    }
  } else if (hasMercy && hasKilled) {
    if (hostTier >= 3) {
      reactionTitle = '⚖️ CONFLICTING BONDS: BITTERSWEET MERCY';
      reactionDialogue = pickRandom([
        "You reached out to save me, while others drew their swords to end me... I don't blame any of you. Thank you for showing me warmth one last time, Master.",
        "A blade swung in judgment, and a hand offered in mercy... It's so confusing, but I'm glad you were here with me.",
        "Even when your allies wanted me dead, you still chose to spare me... Thank you for seeing me as Sakura."
      ]);
      reactionBanner = 'The cavern echoes with the fading whispers of the corrupted Grail vessel.';
      embedColor = 0xa21caf;
    } else {
      reactionTitle = '⚖️ CONFLICTING BONDS: BITTERSWEET PASSING';
      reactionDialogue = pickRandom([
        "Some of you showed me kindness... while others saw the monster I had become. Both of you were right. Thank you... for giving me one last glimpse of light.",
        "A hand offered in mercy, and a blade swung in judgment... Fufu. That is the true nature of this war, isn't it?",
        "One tried to save me, one tried to cut me down... I don't hate either of you. Thank you for ending the nightmare."
      ]);
      reactionBanner = 'The cavern echoes with the fading whispers of the corrupted Grail vessel.';
      embedColor = 0xbe185d;
    }
  } else if (hasBetrayed) {
    reactionTitle = '🌑 CHAOS IN THE CAVERN: TRAGIC COLLAPSE';
    reactionDialogue = pickRandom([
      "I wanted to believe you... I really did! But the darkness inside me was too heavy... forgive me...!",
      "The shadow consumed your devotion... I'm so sorry! I couldn't stop the mud from drowning you!",
      "It was too late for me from the start... Don't look back as you retreat from the dark!"
    ]);
    reactionBanner = 'The cavern rumbles as remnants of the shadow retreat into the leylines.';
    embedColor = 0x831843;
  } else {
    reactionTitle = '🌸 THE SHADOW’S REST';
    reactionDialogue = pickRandom([
      "...Thank you for seeing this through to the end, Master. Until we meet under the cherry blossoms again.",
      "The battle is over... The mud has gone quiet. Take your spoils and leave this cavern before the shadows awaken again."
    ]);
    reactionBanner = 'The holy grail resonance subsides quietly.';
    embedColor = 0xbe185d;
  }

  // Render Visual Novel Reaction Image Canvas (1280x720 with her sprite)
  let reactionAttachment: AttachmentBuilder | null = null;
  try {
    const vnRes = await renderDarkSakuraVNDialogueImage({
      title: reactionTitle,
      speakerName: 'Dark Sakura',
      dialogue: reactionDialogue,
      easterEggBanner: reactionBanner
    });
    reactionAttachment = new AttachmentBuilder(vnRes.buffer, { name: 'dark_sakura_reaction_vn.png' });
  } catch (err) {
    console.error('Failed to generate Dark Sakura reaction VN image:', err);
  }

  // Final Embed
  const finalEmbed = new EmbedBuilder()
    .setTitle(`🏆 RAID CONCLUDED: ${reactionTitle}`)
    .setDescription(
      `### 🌸 Dark Sakura's Parting Words\n` +
      `> *“${reactionDialogue}”*\n\n` +
      `✨ *${reactionBanner}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Resolution & Spoils of War:**\n` +
      resultReports.join('\n\n') + `\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Her memory of your choices has been etched into the Grail.*`
    )
    .setColor(embedColor)
    .setFooter({ text: 'Holy Grail War PvE • Consequential Raid Engine' });

  if (reactionAttachment) {
    finalEmbed.setImage('attachment://dark_sakura_reaction_vn.png');
  } else {
    finalEmbed.setImage(DARK_SAKURA_ASSETS.caveBackground);
  }

  const editPayload: any = {
    content: '✨ **The Raid Encounter Has Concluded.**',
    embeds: [finalEmbed],
    components: []
  };
  if (reactionAttachment) {
    editPayload.files = [reactionAttachment];
  }

  try {
    await promptMsg.edit(editPayload);
  } catch (editErr) {
    console.warn('Failed to edit promptMsg with ending VN reaction, falling back to channel.send:', editErr);
    try {
      if (promptMsg.channel && typeof promptMsg.channel.send === 'function') {
        await promptMsg.channel.send(editPayload);
      }
    } catch (sendErr) {
      console.error('Failed channel.send fallback for ending reaction:', sendErr);
    }
  }
}
