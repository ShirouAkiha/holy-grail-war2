const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const MASTERS_FILE = path.join(DATA_DIR, 'masters.json');

console.log('=====================================================');
console.log('[Recovery Engine] Restoring Master Profile 780278575860678676');
console.log('=====================================================');

if (!fs.existsSync(MASTERS_FILE)) {
  console.error('❌ masters.json not found in data directory.');
  process.exit(1);
}

let masters = [];
try {
  masters = JSON.parse(fs.readFileSync(MASTERS_FILE, 'utf-8'));
} catch (err) {
  console.error('❌ Failed to parse masters.json:', err);
  process.exit(1);
}

// Find user 780278575860678676 or Padoru River or first non-bot profile
let target = masters.find(m => 
  String(m.discordId) === '780278575860678676' ||
  (m.username && m.username.toLowerCase().includes('padoru'))
);

if (!target) {
  target = masters.find(m => !String(m.discordId).startsWith('master_'));
}

if (!target) {
  console.log('Creating profile for Discord ID 780278575860678676...');
  target = {
    id: 'master_780278575860678676',
    discordId: '780278575860678676',
    username: 'Padoru River',
    saintQuartz: 300,
    summonTickets: 10,
    commandSeals: 3,
    actionPoints: 100,
    maxActionPoints: 100,
    pityCount: 0,
    grailWarWins: 5,
    duelsWon: 20,
    duelsLost: 3,
    servantKills: 8,
    totalBattleWins: 28,
    servants: [],
    craftEssences: []
  };
  masters.push(target);
}

console.log(`Found target Master profile: "${target.username}" (ID: ${target.discordId})`);

const doorCe = {
  id: 'ce_bond_lucia_lyozes',
  name: 'The Closed Door Insignia',
  rarity: 4,
  cost: 9,
  hpBonus: 100,
  atkBonus: 100,
  isBondCe: true,
  bondServantId: 'lucia_lyozes',
  instanceId: `ce_inst_ce_bond_lucia_lyozes_${Date.now()}`,
  locked: true,
  effectText: 'When equipped to Lucernalia Lyozes: Increases Critical Damage by 30% and Critical Star Gather Rate by 30% for all allies.'
};

if (!target.craftEssences) target.craftEssences = [];
let existingCe = target.craftEssences.find((c) => c.id === doorCe.id);
if (!existingCe) {
  target.craftEssences.push(doorCe);
  existingCe = doorCe;
}

const roster = [
  {
    id: 'lucia_lyozes',
    name: 'Lucernalia Lyozes',
    servantClass: 'Lancer',
    rarity: 5,
    bondLevel: 10,
    bondExp: 6800,
    active: true,
    equippedCeId: doorCe.id,
    equippedCe: { ...doorCe }
  },
  {
    id: 'cu_chulainn',
    name: 'Cú Chulainn',
    servantClass: 'Lancer',
    rarity: 5,
    bondLevel: 10,
    bondExp: 6800,
    active: false
  },
  {
    id: 'scathach',
    name: 'Scáthach',
    servantClass: 'Lancer',
    rarity: 5,
    bondLevel: 10,
    bondExp: 6800,
    active: false
  },
  {
    id: 'jeanne_d_arc_alter',
    name: "Jeanne d'Arc (Alter)",
    servantClass: 'Avenger',
    rarity: 5,
    bondLevel: 9,
    bondExp: 5400,
    active: false
  },
  {
    id: 'jeanne_d_arc',
    name: "Jeanne d'Arc",
    servantClass: 'Ruler',
    rarity: 5,
    bondLevel: 10,
    bondExp: 6800,
    active: false
  },
  {
    id: 'mhx_alter',
    name: 'Mysterious Heroine X (Alter)',
    servantClass: 'Berserker',
    rarity: 5,
    bondLevel: 1,
    bondExp: 53,
    active: false
  }
];

if (!target.servants) target.servants = [];

roster.forEach(item => {
  const existingIdx = target.servants.findIndex(s => 
    s.templateId === item.id || s.id === item.id || s.template?.id === item.id
  );

  const servantInst = {
    id: `contract_${item.id}_${target.discordId}`,
    masterId: target.id,
    templateId: item.id,
    level: 90,
    experience: 50000,
    allocatedStats: { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 },
    availableStatPoints: 10,
    skillLevels: [10, 10, 10],
    npLevel: 5,
    customQuotes: {},
    bondLevel: item.bondLevel,
    bondExp: item.bondExp,
    equippedCeId: item.equippedCeId,
    equippedCe: item.equippedCe,
    template: {
      id: item.id,
      name: item.name,
      servantClass: item.servantClass,
      rarity: item.rarity,
      baseHp: 28000,
      baseAtk: 11000
    }
  };

  if (existingIdx !== -1) {
    target.servants[existingIdx] = servantInst;
  } else {
    target.servants.push(servantInst);
  }

  if (item.active) {
    target.activeServantId = servantInst.id;
  }
});

target.saintQuartz = Math.max(target.saintQuartz || 0, 300);
target.commandSeals = 3;

fs.writeFileSync(MASTERS_FILE, JSON.stringify(masters, null, 2), 'utf-8');

console.log(`\n=====================================================`);
console.log(`SUCCESS! Restored ${target.servants.length} Servants for ${target.username} (ID: ${target.discordId}):`);
target.servants.forEach(s => {
  console.log(` - ${s.template?.name || s.name} [Bond Lv. ${s.bondLevel}/10] ${s.equippedCe ? `(Equipped CE: ${s.equippedCe.name})` : ''}`);
});
console.log(`=====================================================\n`);
