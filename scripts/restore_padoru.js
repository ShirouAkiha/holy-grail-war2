const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const MASTERS_FILE = path.join(DATA_DIR, 'masters.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

console.log('=====================================================');
console.log('[Emergency Restore] Restoring Padoru River Team Roster');
console.log('=====================================================');

if (!fs.existsSync(MASTERS_FILE)) {
  console.error('masters.json not found in data directory.');
  process.exit(1);
}

let masters = [];
try {
  masters = JSON.parse(fs.readFileSync(MASTERS_FILE, 'utf-8'));
} catch (err) {
  console.error('Failed to parse masters.json:', err);
  process.exit(1);
}

// Find existing Padoru profile or the first non-bot profile, or create one
let padoru = masters.find(m => 
  (m.username && m.username.toLowerCase().includes('padoru')) ||
  (m.discordId && m.discordId.toLowerCase().includes('padoru'))
);

if (!padoru) {
  // Check if there is any real discord user (id doesn't start with master_)
  padoru = masters.find(m => !String(m.discordId).startsWith('master_'));
}

if (!padoru) {
  console.log('No user profile found yet. Creating Padoru River master profile...');
  padoru = {
    id: `master_padoru_river`,
    discordId: `padoru_river`,
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
  masters.push(padoru);
}

console.log(`Found Master Profile: "${padoru.username}" (ID: ${padoru.discordId})`);

// 1. Ensure Bond CE for Lucia is present and equipped
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

if (!padoru.craftEssences) padoru.craftEssences = [];
let existingCe = padoru.craftEssences.find(c => c.id === doorCe.id);
if (!existingCe) {
  padoru.craftEssences.push(doorCe);
  existingCe = doorCe;
}

// 2. Define the exact 6 servants
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

if (!padoru.servants) padoru.servants = [];

roster.forEach(item => {
  const existingIdx = padoru.servants.findIndex(s => 
    s.templateId === item.id || s.id === item.id || s.template?.id === item.id
  );

  const servantInst = {
    id: `contract_${item.id}_${padoru.discordId}`,
    masterId: padoru.id,
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
    padoru.servants[existingIdx] = servantInst;
  } else {
    padoru.servants.push(servantInst);
  }

  if (item.active) {
    padoru.activeServantId = servantInst.id;
  }
});

padoru.saintQuartz = Math.max(padoru.saintQuartz || 0, 300);
padoru.commandSeals = 3;

fs.writeFileSync(MASTERS_FILE, JSON.stringify(masters, null, 2), 'utf-8');
const backupPath = path.join(BACKUPS_DIR, 'masters.latest.json');
try {
  fs.writeFileSync(backupPath, JSON.stringify(masters, null, 2), 'utf-8');
} catch {}

console.log(`\n=====================================================`);
console.log(`SUCCESS! Restored ${padoru.servants.length} Servants for ${padoru.username}:`);
padoru.servants.forEach(s => {
  console.log(` - ${s.template?.name || s.name} [Bond Lv. ${s.bondLevel}/10] ${s.equippedCe ? `(Equipped CE: ${s.equippedCe.name})` : ''}`);
});
console.log(`Active Servant: Lucernalia Lyozes`);
console.log(`Saint Quartz: ${padoru.saintQuartz} SQ | Command Seals: 3`);
console.log(`=====================================================\n`);
