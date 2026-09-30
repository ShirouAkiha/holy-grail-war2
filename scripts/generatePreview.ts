import fs from 'fs';
import path from 'path';
import { RAID_BOSSES } from '../src/data/raidBosses';
import { renderRaidBattlefield, RaidBattleState } from '../src/canvas/raidRenderer';

async function generateAllPreviews() {
  const boss = RAID_BOSSES['tiamat'];
  if (!boss) {
    console.error('Tiamat boss config not found!');
    return;
  }

  const mockServant = {
    id: 's1',
    masterId: 'm1',
    templateId: 'jalter',
    template: {
      name: "Jeanne d'Arc (Alter)",
      servantClass: 'Avenger',
      rarity: 5,
      avatarUrl: 'https://images.fineartamerica.com/images/hostedimages/individual/5/24855848.jpg',
      spriteUrl: 'https://images.fineartamerica.com/images/hostedimages/individual/5/24855848.jpg',
      baseAtk: 12297,
      baseHp: 11761,
      skills: []
    },
    level: 90,
    ascension: 4,
    bondLevel: 10
  } as any;

  const mockParticipants = [
    {
      userId: 'u1',
      username: 'Master One',
      servant: mockServant,
      currentHp: 14200,
      maxHp: 14200,
      npGauge: 100,
      critStars: 20,
      skillCooldowns: [0, 0, 0]
    },
    {
      userId: 'u2',
      username: 'Master Two',
      servant: mockServant,
      currentHp: 12500,
      maxHp: 14200,
      npGauge: 50,
      critStars: 10,
      skillCooldowns: [0, 0, 0]
    }
  ];

  for (let phase = 1; phase <= 3; phase++) {
    const mockState: RaidBattleState = {
      boss,
      bossCurrentHp: phase === 1 ? 14000000 : phase === 2 ? 10000000 : 5000000,
      bossMaxHp: 14000000,
      bossCharge: 2,
      round: 3,
      participants: mockParticipants,
      activeMasterIndex: 0,
      recentLogs: [`⚔️ Phase ${phase} Preview Render`],
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
