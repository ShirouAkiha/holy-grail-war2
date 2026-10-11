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
 * High-frequency raid progression designed for players doing multiple raids daily:
 * - Tier 4: Pacifist Devotion (Sanctuary / Pacifist Milestone Clear) - Requires 50+ spares with 0 kills OR 75+ spares with >=95% ratio & 25+ streak
 * - Tier 3: Wavering Maiden (Hard-earned tolerance) - Requires at least 20+ raids, 16+ spares, >=80% spare ratio, and 8+ consecutive mercy streak
 * - Tier 1: The Butcher (Cold-blooded Executioner) - Requires at least 20+ raids, 16+ kills, >=80% kill ratio, and 8+ consecutive slayer streak
 * - Tier 2: Skeptic Magus (Guarded / Neutral) - Default for anyone with < 20 raids or mixed/fluctuating choices
 */
export function getDarkSakuraTier(record: DarkSakuraKarmaRecord): 1 | 2 | 3 | 4 {
  const total = record.spares + record.kills;

  // Tier 4: True Pacifist Devotion (Ultra-rare high bar)
  if (record.spares >= 50 && record.kills === 0) return 4;
  if (record.spares >= 75 && (record.spares / Math.max(1, total)) >= 0.95 && record.mercyStreak >= 25) return 4;

  // Anyone with fewer than 20 total raids remains in Tier 2 (Guarded / Skeptical)
  // She does not open her heart or acknowledge anyone after just a few runs.
  if (total < 20) return 2;

  const spareRatio = record.spares / total;

  // Tier 3: Wavering Maiden (Requires sustained mercy over multiple days of raiding)
  if (record.spares >= 16 && spareRatio >= 0.80 && record.mercyStreak >= 8) {
    return 3;
  }

  // Tier 1: The Butcher (Requires persistent execution over multiple days of raiding)
  if (record.kills >= 16 && ((record.kills / total) >= 0.80) && record.slayerStreak >= 8) {
    return 1;
  }

  // Everyone else is Tier 2 (Guarded / Testing)
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
  trigger: 'boss_low_hp' | 'break_gauge' | 'player_low_hp' | 'guts_survived',
  record: DarkSakuraKarmaRecord,
  servantName?: string
): { quote: string } {
  const tier = getDarkSakuraTier(record);

  switch (trigger) {
    case 'boss_low_hp':
      if (tier === 4) {
        return {
          quote: pickRandom([
            "Even when I'm breaking apart... you still look at me with those warm eyes. Why won't you just let me rest?",
            "My vessel is shattering... but your blade never once sought my throat. Master... is this your kindness?",
            "The shadow is pulling me under... yet you stand there without fear. Please... stay safe."
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
      return {
        quote: pickRandom([
          "The black mud spills from my wounds... Can you hear the shadows screaming beneath the surface?",
          "My vessel trembles... but All The World's Evil won't stop until every Leyline burns!",
          "You think wounding this body matters? The shadow only hungers for more mana!"
        ])
      };

    case 'break_gauge':
      if (tier === 4) {
        return {
          quote: pickRandom([
            "The seal shattered... The abyssal core is exposed. Please... don't let the shadow consume us both!",
            "The corruption is overflowing! Keep your distance... I can't guarantee I won't hurt you!",
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
      return {
        quote: pickRandom([
          "Agh...! The Grail's corruption overflows! The true shadow awakens now!",
          "The barrier cracked... The black mud surges forward! Stand back!",
          "You forced open the abyssal gates... Now taste the full weight of Angra Mainyu!"
        ])
      };

    case 'player_low_hp': {
      const sName = servantName || 'your Servant';
      if (tier === 4) {
        return {
          quote: pickRandom([
            `Stop! ${sName} is at their limit... Don't force them to suffer for my sake!`,
            `${sName} can barely stand... Please, retreat before the shadow devours them completely!`,
            `Their spirit origin is fading... Don't make them die in this dark cavern for me!`
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
      return {
        quote: pickRandom([
          `${sName} is drowning in my shadow mud... How much longer can they stand?`,
          `The miasma is suffocating ${sName}... Their knees are giving out.`,
          `${sName}'s mana is being drained away... They won't last another turn.`
        ])
      };
    }

    case 'guts_survived': {
      const targetName = servantName || 'Your Servant';
      if (tier === 4) {
        return {
          quote: pickRandom([
            `They stood back up... ${targetName}'s soul refuses to break in this dark cavern.`,
            `Such stubborn resolve... ${targetName} rises again despite the shadow's weight.`,
            `${targetName} survived...? Their bond with you must be truly unbreakable.`
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
      return {
        quote: pickRandom([
          `Refusing to fall? ${targetName}'s conviction is stubborn...`,
          `${targetName} pulled back from the brink... Impressive, but futile.`,
          `Still standing after that hit? The shadow will chew through them next time.`
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
  if (tier === 4) {
    // Pacifist Devotion: 55% - 65% (Even at peak pacifism, Angra Mainyu's corruption and her dark urges make sparing a tense gamble)
    return Math.min(0.65, 0.55 + Math.min(record.mercyStreak * 0.003, 0.10));
  }
  if (tier === 3) {
    // Wavering Maiden (Hard-earned trust after 20+ raids & 8+ streak):
    // 24% base, scales with streak up to max 34% (so 2 out of 3 times, shadows still lash out!)
    return Math.min(0.34, 0.24 + Math.min((record.mercyStreak - 8) * 0.01, 0.10));
  }
  if (tier === 1) {
    // The Butcher (Hardened executioner): Mud lashes out violently (3% - 6%)
    return Math.max(0.03, 0.06 - Math.min((record.slayerStreak - 8) * 0.005, 0.03));
  }
  // Tier 2 (Neutral / Under 20 raids or mixed):
  // Reaching into the corrupt mud of All The World's Evil is deadly!
  // 10% base + up to 4% for small mercy streaks (max 14% success)
  return Math.min(0.14, 0.10 + Math.min(record.mercyStreak * 0.005, 0.04));
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
      dialogue = pickRandom([
        `"${host.username}, who is this standing behind you? Their hands reek of my dried blood. Did you bring an executioner to finish what your soft heart couldn't?"`,
        `"${host.username}... you brought someone whose weapon has cut me down repeatedly. Are you hiding behind a killer, or did they force you to bring them here?"`,
        `"A gentle soul leading a bloodthirsty hound... What a bizarre pairing, ${host.username}. Will your kindness protect them when my shadow lashes out?"`,
        `"${host.username}... I thought you were different, yet you march alongside an executioner. Did your resolve crumble so easily?"`
      ]);
      bannerQuote = 'Did you bring a butcher to finish what your soft heart couldn\'t?';
    } else if (allSlayers) {
      dialogue = pickRandom([
        `"A full circle of executioners gathered together... How flattering. You must really want to watch me dissolve under your Noble Phantasms today."`,
        `"Four cold-blooded killers in one cavern... Ahaha! Step into the mud then—let's see who breaks first."`,
        `"Not a single drop of hesitation among you... Excellent. I won't have to feel guilty when my black tendrils tear you to pieces."`,
        `"A vanguard of pure butchers... Come then! Let All The World's Evil show you what true slaughter looks like!"`
      ]);
      bannerQuote = 'A full circle of executioners gathered together... How flattering.';
    } else if (allMercy) {
      dialogue = pickRandom([
        `"Not a single killer among all four of you? A circle of saints marching straight into the abyss... Do you really think this mud won't swallow you if you hesitate?"`,
        `"Four soft-hearted Masters standing shoulder-to-shoulder in my cavern... Are you trying to save a monster, or planning a group execution of your own naivety?"`,
        `"Fufu... So much gentle resolve in one dark place. It's almost sickening. Let's see if your collective mercy can survive my shadows."`,
        `"None of you came to draw blood today? How foolishly idealistic... The corrupted Grail doesn't reward pacifists easily."`
      ]);
      bannerQuote = 'A circle of saints marching straight into the abyss...';
    } else {
      dialogue = pickRandom([
        `"Another vanguard gathered to harvest the corrupted Grail... Some of you have drawn my blood, others held out a hand. Let's see which conviction triumphs today."`,
        `"A divided team enters the cavern... Some come with mercy, others with bare blades. How long before you turn on each other in the dark?"`,
        `"A mixture of killers and dreamers... How chaotic. My shadow will devour both all the same if you hesitate for even a second."`,
        `"Conflict inside your own party before the battle even begins... Fufu. Step forward then, let's see whose will dictates the end."`
      ]);
      bannerQuote = 'Let\'s see which conviction triumphs today.';
    }
  } else {
    // Solo player dynamics
    if (hostRecord.spares === 0 && hostRecord.kills === 0) {
      dialogue = pickRandom([
        `"The leyline whispers of a new challenger... Welcome to the bottom of the world, ${host.username}. Don't drown in my shadows."`,
        `"Another soul wanders into the cavern of shadows... Tell me, ${host.username}, did Zouken send you, or did you come to be devoured by your own foolishness?"`,
        `"You step into my shadow without fear, ${host.username}... How amusing. Everyone thinks they can stay pure until the black mud fills their lungs."`,
        `"A fresh face in the dark... Fufu. Don't look at me with those pitying eyes, ${host.username}. I was insane from the very start."`
      ]);
      bannerQuote = 'Welcome to the bottom of the world... Don\'t drown in my shadows.';
    } else if (isQuickRematch) {
      dialogue = pickRandom([
        `"Back so soon? You barely cleaned the mud off your boots. Are you that eager to see me again, ${host.username}?"`,
        `"Returned already, ${host.username}? Did the shadow's chill linger on your skin, or could you not resist the smell of corrupted mana?"`,
        `"You barely caught your breath before running right back into my cavern... Is this courage, ${host.username}, or an obsession with your own doom?"`,
        `"Still lingering around my shadow, ${host.username}? Fufu... The mud hasn't even dried from our last encounter."`
      ]);
      bannerQuote = 'Back so soon? You barely cleaned the mud off your boots.';
    } else if (hostRecord.lastOutcome === 'spared_betrayed') {
      dialogue = pickRandom([
        `"In our last bout... the shadows swallowed you before you could pull away. Yet you step right back into my cavern without flinching. Are you courageous, or just an idiot, ${host.username}?"`,
        `"You reached your hand into my black mud and felt it tear at your flesh... so why are you back, ${host.username}? Do you enjoy watching your devotion rot?"`,
        `"My shadows devoured your hope last time, ${host.username}... and still you return. Did you come to hear me laugh at your broken resolve?"`,
        `"I warned you that All The World's Evil drags down anyone who touches it. Yet here you stand again, ${host.username}... stubborn to the end."`
      ]);
      bannerQuote = 'Yet you step right back into my cavern without flinching...';
    } else if (hostRecord.mercyStreak >= 3) {
      dialogue = pickRandom([
        `"That's ${hostRecord.mercyStreak} consecutive bouts where you stayed your blade at the very end... When will you learn that monsters don't deserve fairy tales, ${host.username}?"`,
        `"${hostRecord.mercyStreak} times you offered mercy to a creature made of black mud... Are you trying to prove something to yourself, ${host.username}, or mock my despair?"`,
        `"You refuse to cut me down, even after ${hostRecord.mercyStreak} encounters... My shadows grow restless around you, ${host.username}, but why doesn't your hand tremble?"`,
        `"Fufu... ${hostRecord.mercyStreak} times you held back your final blow. If my Senpai saw you now, would he call you kind, or foolish, ${host.username}?"`
      ]);
      bannerQuote = `When will you learn that monsters don't deserve fairy tales?`;
    } else if (hostRecord.slayerStreak >= 3) {
      dialogue = pickRandom([
        `"Another round, another execution. You treat carving me apart like routine paperwork, don't you, ${host.username}? Come on then... draw your weapon."`,
        `"${hostRecord.slayerStreak} times you've carved through my flesh without hesitation. Ahaha... You really enjoy the sound of the Grail breaking, don't you, ${host.username}?"`,
        `"The executioner returns for their ${hostRecord.slayerStreak}th massacre... Your weapon is still dark with my blood, ${host.username}. Let's see if you can shatter my core again."`,
        `"A blood-soaked streak of ${hostRecord.slayerStreak} executions... You don't see a girl here at all, do you, ${host.username}? Just a boss to harvest."`
      ]);
      bannerQuote = 'You treat carving me apart like routine paperwork, don\'t you?';
    } else if (hostTier === 1) {
      dialogue = pickRandom([
        `"Ah, the butcher returns. Eager to see if my core shatters faster this time, ${host.username}? Let me show you what it feels like to rot in the mud."`,
        `"The merciless magus steps back into my cavern... Every time you open your mouth, ${host.username}, I remember why I stopped expecting salvation."`,
        `"Cold, efficient, and relentless... You remind me of the crest worms, ${host.username}. Come, let's see whose malice cuts deeper."`,
        `"You carved away every piece of mercy in your heart, didn't you, ${host.username}? Fufu... Good. Monsters are much easier to devour when they don't pretend to care."`
      ]);
      bannerQuote = 'Ah, the butcher returns. Eager to carve me open again?';
    } else if (hostTier === 3) {
      dialogue = pickRandom([
        `"You're back... Even in this pitch-black cavern, your presence feels warm. My shadows hesitate around you, ${host.username}."`,
        `"Why do you look at me like that, ${host.username}? I told you I'm corrupted to the root... yet your eyes never hold hatred."`,
        `"Every time you step into this cavern, ${host.username}, the screaming inside my head grows a little quieter... Don't make me rely on you."`,
        `"You stayed your hand so many times... Is it really possible that someone looks at this shadow and doesn't see a monster, ${host.username}?"`
      ]);
      bannerQuote = 'My shadows hesitate around you...';
    } else {
      dialogue = pickRandom([
        `"Another bout. Are you going to cut me down like a true magus, or pretend to be my savior today, ${host.username}? You Masters are all the same."`,
        `"The mud stirs as you draw near, ${host.username}... Will you bring judgment or false hope to the bottom of the cavern today?"`,
        `"Fufu... Another challenger testing their luck against All The World's Evil. Let's see how long your resolve lasts under the shadow, ${host.username}."`,
        `"You step closer to the corrupted vessel, ${host.username}. Keep your guard up... the shadows don't care about your intentions."`
      ]);
      bannerQuote = 'Are you going to cut me down, or pretend to be my savior?';
    }
  }

  // Append servant Easter Egg if present (pure dialogue only)
  if (egg) {
    dialogue += `\n\n"${egg.quote}"`;
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
        reason: 'Host is peaceful, but an ally is a notorious Slayer.'
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
        `Nee-san had the spotlight, Senpai had his gentle ideals, and I was left to drown in this darkness. I relish tearing through flesh and taking every drop of mana.\n\n` +
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
        `  └─ *Severed the shadow core cleanly.*\n` +
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
          `  └─ *The shadows receded with a trembling smile.*\n` +
          `  └─ 💎 **DOUBLED SPOILS:** **+${doubleSq} SQ**, **+${doubleExp.toLocaleString()} EXP** on **${sName}**${expInfo}, and **+8x Universal EXP Embers** ✨ (4x ★5 SSR + 4x ★4 SR)${ceDropNotice}`
        );
      } else {
        participantOutcomes.push('spared_betrayed');
        // Betrayal / mud devour!
        record.betrayalCount += 1;
        record.mercyStreak = 0;
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
          `  └─ *The black mud flared out of control!* *"I'm sorry... I can't hold it back!!"*\n` +
          `  └─ 📦 **Consolation:** **+${pityExp.toLocaleString()} EXP** on **${sName}**${expInfo}, and **+2x Universal EXP Embers** ✨ (2x ★4 SR) *(0 SQ gained)*`
        );
      }
    }

    await saveMaster(master);
  }

  // Determine decisive ending reaction dialogue
  const hasKilled = participantOutcomes.includes('killed');
  const hasMercy = participantOutcomes.includes('spared_mercy');
  const hasBetrayed = participantOutcomes.includes('spared_betrayed');

  let reactionTitle = 'THE SHADOW’S PARTING';
  let reactionDialogue = '';
  let reactionBanner = '';
  let embedColor = 0xbe185d;

  if (hasMercy && !hasKilled && !hasBetrayed) {
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
  } else if (hasKilled && !hasMercy && !hasBetrayed) {
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
  } else if (hasBetrayed && !hasMercy && !hasKilled) {
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
  } else if (hasMercy && hasKilled) {
    reactionTitle = '⚖️ CONFLICTING BONDS: BITTERSWEET PASSING';
    reactionDialogue = pickRandom([
      "Some of you showed me kindness... while others saw the monster I had become. Both of you were right. Thank you... for giving me one last glimpse of light.",
      "A hand offered in mercy, and a blade swung in judgment... Fufu. That is the true nature of this war, isn't it?",
      "One tried to save me, one tried to cut me down... I don't hate either of you. Thank you for ending the nightmare."
    ]);
    reactionBanner = 'The cavern echoes with the fading whispers of the corrupted Grail vessel.';
    embedColor = 0xbe185d;
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
