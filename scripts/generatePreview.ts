import fs from 'fs';
import path from 'path';
import { RAID_BOSSES } from '../src/data/raidBosses';
import { SERVANT_DATABASE } from '../src/data/servants';
import { renderRaidBattlefield, RaidBattleState } from '../src/canvas/raidRenderer';

async function generateAllPreviews() {
  const boss = RAID_BOSSES['tiamat'];
  if (!boss) {
    console.error('Tiamat boss config not found!');
    return;
  }

  const jalterTpl = SERVANT_DATABASE.find(t => t.id === 'jeanne_alter') || SERVANT_DATABASE[0];
  const artoriaTpl = SERVANT_DATABASE.find(t => t.id === 'artoria_pendragon') || SERVANT_DATABASE[1];
  const gilTpl = SERVANT_DATABASE.find(t => t.id === 'gilgamesh_archer') || SERVANT_DATABASE[2];
  const scathachTpl = SERVANT_DATABASE.find(t => t.id === 'scathach_lancer') || SERVANT_DATABASE[3];

  const mockParticipants = [
    {
      userId: 'u1',
      username: 'Master One',
      servant: {
        id: 's1',
        masterId: 'u1',
        templateId: jalterTpl.id,
        template: jalterTpl,
        level: 90,
        ascension: 4,
        bondLevel: 10
      } as any,
      currentHp: 14200,
      maxHp: 14200,
      npGauge: 100,
      critStars: 20,
      skillCooldowns: [0, 0, 0]
    },
    {
      userId: 'u2',
      username: 'Master Two',
      servant: {
        id: 's2',
        masterId: 'u2',
        templateId: artoriaTpl.id,
        template: artoriaTpl,
        level: 90,
        ascension: 4,
        bondLevel: 10
      } as any,
      currentHp: 12500,
      maxHp: 14200,
      npGauge: 150,
      critStars: 15,
      skillCooldowns: [0, 1, 0]
    },
    {
      userId: 'u3',
      username: 'Master Three',
      servant: {
        id: 's3',
        masterId: 'u3',
        templateId: gilTpl.id,
        template: gilTpl,
        level: 90,
        ascension: 4,
        bondLevel: 8
      } as any,
      currentHp: 11000,
      maxHp: 13500,
      npGauge: 80,
      critStars: 30,
      skillCooldowns: [2, 0, 0]
    },
    {
      userId: 'u4',
      username: 'Master Four',
      servant: {
        id: 's4',
        masterId: 'u4',
        templateId: scathachTpl.id,
        template: scathachTpl,
        level: 90,
        ascension: 4,
        bondLevel: 9
      } as any,
      currentHp: 13800,
      maxHp: 14800,
      npGauge: 200,
      critStars: 10,
      skillCooldowns: [0, 0, 0]
    }
  ];

  for (let phase = 1; phase <= 3; phase++) {
    const hudActions = [
      {
        category: 'MASTER STRIKE',
        categoryColor: '#38bdf8',
        headline: 'Lucernalia Lyozes',
        bigStat: '921,483 DMG',
        bigStatColor: '#fde047',
        subDetail: 'CRITICAL HIT (2.0x) • +63% NP • +25 Stars',
        subDetailColor: '#f43f5e'
      },
      {
        category: 'SKILL ACTIVATED',
        categoryColor: '#fbbf24',
        headline: "Jeanne d'Arc (Alter)",
        bigStat: 'DRAGON WITCH EX',
        bigStatColor: '#fde047',
        subDetail: '+20% ATK (3T) • +15 Stars Generated',
        subDetailColor: '#38bdf8'
      },
      {
        category: 'COMMAND SEAL',
        categoryColor: '#c084fc',
        headline: 'Artoria Pendragon',
        bigStat: 'FULL RESTORE (100% NP)',
        bigStatColor: '#38bdf8',
        subDetail: 'Max HP Restored • +100% NP (2 Seals Left)',
        subDetailColor: '#a7f3d0'
      }
    ];

    const mockState: RaidBattleState = {
      boss,
      bossCurrentHp: phase === 1 ? 14000000 : phase === 2 ? 10000000 : 5000000,
      bossMaxHp: 14000000,
      bossCharge: 2,
      round: 4,
      participants: mockParticipants,
      activeMasterIndex: 0,
      recentLogs: [
        '⚔️ Strike: Lucernalia dealt 921,483 CRIT DMG! (+63% NP, +25★)',
        '😈 Enemy: Tiamat Strike (7,402 DMG)',
        '👁️ Skill: [Tremor Step] 🔻 -20% DEF (3T)',
        '🌊 [Sea of Life]: -2,000 HP Corrode • 🔒 NP Sealed'
      ],
      lastPlayerAttackLog: '⚔️ Strike: Lucernalia dealt 921,483 CRIT DMG! (+63% NP, +25★)',
      turnDamageTaken: 921483,
      lastHudAction: hudActions[phase - 1],
      lastEnemyPhase: {
        actionName: 'Tiamat Strike',
        strikeDamage: 7402,
        curseDamage: 2000,
        totalDamage: 9402,
        skillName: 'Tremor Step',
        skillDesc: '🔻 -20% DEF (3T)',
        debuffsInflicted: ['-20% DEF (3T)'],
        bossBuffsGained: [],
        specialEvents: ['🌊 [Sea of Life]: -2,000 HP Corrode • 🔒 NP Sealed']
      },
      currentPhase: phase,
      totalPhases: 3,
      breakGaugesRemaining: 3 - phase
    };

    console.log(`Rendering Phase ${phase} canvas...`);
    const { buffer } = await renderRaidBattlefield(mockState, false);

    const outPath = path.join(process.cwd(), 'public', `preview_phase${phase}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved: ${outPath} (${buffer.length} bytes)`);
  }

  console.log('Done generating all 3 preview renders!');
}

generateAllPreviews().catch(console.error);
