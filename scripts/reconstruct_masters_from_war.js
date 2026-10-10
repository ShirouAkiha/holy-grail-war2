const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const MASTERS_FILE = path.join(DATA_DIR, 'masters.json');
const GRAIL_WAR_FILE = path.join(DATA_DIR, 'grail_war.json');
const GRAIL_WAR_BACKUP = path.join(BACKUPS_DIR, 'grail_war.latest.json');
const CHAT_MEM_FILE = path.join(DATA_DIR, 'servant_chat_memory.json');

console.log('=====================================================');
console.log('[Master Reconstruction Engine] Rebuilding All Masters');
console.log('=====================================================');

// 1. Load Canon Servants
const canonServants = [
  { id: 'artoria_pendragon', name: 'Artoria Pendragon', servantClass: 'Saber', rarity: 5 },
  { id: 'artoria_pendragon_alter', name: 'Artoria Pendragon (Alter)', servantClass: 'Saber', rarity: 4 },
  { id: 'emiya', name: 'EMIYA', servantClass: 'Archer', rarity: 4 },
  { id: 'gilgamesh', name: 'Gilgamesh', servantClass: 'Archer', rarity: 5 },
  { id: 'cu_chulainn', name: 'Cú Chulainn', servantClass: 'Lancer', rarity: 3 },
  { id: 'scathach', name: 'Scáthach', servantClass: 'Lancer', rarity: 5 },
  { id: 'karna', name: 'Karna', servantClass: 'Lancer', rarity: 5 },
  { id: 'medusa', name: 'Medusa', servantClass: 'Rider', rarity: 3 },
  { id: 'zhuge_liang', name: 'Zhuge Liang (Lord El-Melloi II)', servantClass: 'Caster', rarity: 5 },
  { id: 'artoria_caster', name: 'Artoria Caster', servantClass: 'Caster', rarity: 5 },
  { id: 'heracles', name: 'Heracles', servantClass: 'Berserker', rarity: 4 },
  { id: 'mhx_alter', name: 'Mysterious Heroine X (Alter)', servantClass: 'Berserker', rarity: 5 },
  { id: 'jeanne_d_arc', name: "Jeanne d'Arc", servantClass: 'Ruler', rarity: 5 },
  { id: 'jeanne_d_arc_alter', name: "Jeanne d'Arc (Alter)", servantClass: 'Avenger', rarity: 5 },
  { id: 'lucia_lyozes', name: 'Lucernalia Lyozes', servantClass: 'Lancer', rarity: 5 }
];

let customServants = [];
try {
  const csPath = path.join(DATA_DIR, 'custom_servants.json');
  if (fs.existsSync(csPath)) {
    customServants = JSON.parse(fs.readFileSync(csPath, 'utf-8'));
  }
} catch {}

const allPool = [...canonServants, ...customServants];

function findServant(query) {
  if (!query) return canonServants[0];
  const q = String(query).toLowerCase().trim();
  return allPool.find(s => 
    s.id.toLowerCase() === q || 
    s.name.toLowerCase() === q || 
    s.name.toLowerCase().includes(q) ||
    q.includes(s.name.toLowerCase())
  ) || canonServants[0];
}

// 2. Read Masters File
let mastersList = [];
if (fs.existsSync(MASTERS_FILE)) {
  try {
    mastersList = JSON.parse(fs.readFileSync(MASTERS_FILE, 'utf-8'));
  } catch {}
}
if (!Array.isArray(mastersList)) mastersList = [];

const mastersMap = new Map();
mastersList.forEach(m => {
  if (m && m.discordId) mastersMap.set(m.discordId, m);
});

// 3. Read Grail War Data
let grailWarData = null;
if (fs.existsSync(GRAIL_WAR_FILE)) {
  try {
    grailWarData = JSON.parse(fs.readFileSync(GRAIL_WAR_FILE, 'utf-8'));
  } catch {}
}
if (!grailWarData && fs.existsSync(GRAIL_WAR_BACKUP)) {
  try {
    grailWarData = JSON.parse(fs.readFileSync(GRAIL_WAR_BACKUP, 'utf-8'));
  } catch {}
}

const recoveredCount = { masters: 0, servants: 0 };

if (grailWarData) {
  const sessions = Array.isArray(grailWarData) ? grailWarData : [grailWarData];
  for (const sessionObj of Object.values(grailWarData)) {
    if (!sessionObj) continue;
    const participants = sessionObj.participants || sessionObj;
    if (participants && typeof participants === 'object') {
      for (const [pKey, pVal] of Object.entries(participants)) {
        if (!pVal || typeof pVal !== 'object') continue;
        const discordId = pVal.discordId || pKey;
        if (!discordId || discordId.startsWith('master_')) continue;

        let master = mastersMap.get(discordId);
        if (!master) {
          master = {
            id: `master_${discordId}`,
            discordId,
            username: pVal.username || 'Master',
            avatarUrl: pVal.avatarUrl || '',
            saintQuartz: 300,
            summonTickets: 10,
            commandSeals: pVal.commandSeals || 3,
            actionPoints: 100,
            maxActionPoints: 100,
            pityCount: 0,
            grailWarWins: pVal.kills || 0,
            duelsWon: pVal.kills || 0,
            duelsLost: 0,
            servantKills: pVal.kills || 0,
            totalBattleWins: pVal.kills || 0,
            servants: [],
            craftEssences: []
          };
          mastersMap.set(discordId, master);
          recoveredCount.masters++;
        }

        // Reconstruct Servant
        const sQuery = pVal.servantId || pVal.servantName || pVal.servantClass || 'Saber';
        const template = findServant(sQuery);

        if (!master.servants) master.servants = [];
        const existingS = master.servants.find((s) => s.templateId === template.id || s.id.includes(template.id));
        if (!existingS) {
          const sInst = {
            id: `contract_${template.id}_${discordId}`,
            masterId: master.id,
            templateId: template.id,
            level: 90,
            experience: 50000,
            allocatedStats: { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 },
            availableStatPoints: 10,
            skillLevels: [10, 10, 10],
            npLevel: 5,
            bondLevel: 10,
            bondExp: 6800,
            template: { ...template }
          };
          master.servants.push(sInst);
          recoveredCount.servants++;
        }

        if (!master.activeServantId && master.servants.length > 0) {
          master.activeServantId = master.servants[0].id;
        }
      }
    }
  }
}

// 4. Read Chat Memory Data
if (fs.existsSync(CHAT_MEM_FILE)) {
  try {
    const chatMem = JSON.parse(fs.readFileSync(CHAT_MEM_FILE, 'utf-8'));
    if (chatMem && typeof chatMem === 'object') {
      for (const [memKey, memVal] of Object.entries(chatMem)) {
        // memKey usually contains discordId
        const parts = memKey.split('_');
        const discordId = parts.find(p => /^\d{17,20}$/.test(p));
        if (discordId && !mastersMap.has(discordId)) {
          const master = {
            id: `master_${discordId}`,
            discordId,
            username: (memVal && memVal.masterName) ? memVal.masterName : 'Master',
            saintQuartz: 300,
            summonTickets: 10,
            commandSeals: 3,
            actionPoints: 100,
            maxActionPoints: 100,
            servants: [],
            craftEssences: []
          };
          if (memVal && memVal.servantName) {
            const template = findServant(memVal.servantName);
            const sInst = {
              id: `contract_${template.id}_${discordId}`,
              masterId: master.id,
              templateId: template.id,
              level: 90,
              experience: 50000,
              allocatedStats: { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 },
              availableStatPoints: 10,
              skillLevels: [10, 10, 10],
              npLevel: 5,
              bondLevel: 10,
              bondExp: 6800,
              template: { ...template }
            };
            master.servants.push(sInst);
            master.activeServantId = sInst.id;
          }
          mastersMap.set(discordId, master);
          recoveredCount.masters++;
        }
      }
    }
  } catch {}
}

const finalMastersList = Array.from(mastersMap.values());
fs.writeFileSync(MASTERS_FILE, JSON.stringify(finalMastersList, null, 2), 'utf-8');

const backupPath = path.join(BACKUPS_DIR, 'masters.latest.json');
try {
  fs.writeFileSync(backupPath, JSON.stringify(finalMastersList, null, 2), 'utf-8');
} catch {}

console.log(`\n=====================================================`);
console.log(`RECONSTRUCTION COMPLETE!`);
console.log(`Total Master Profiles in masters.json: ${finalMastersList.length}`);
console.log(`Real Players Recovered: ${finalMastersList.filter(m => !m.discordId.startsWith('master_')).length}`);
console.log(`=====================================================\n`);
finalMastersList.filter(m => !m.discordId.startsWith('master_')).forEach(m => {
  console.log(`👤 Master: ${m.username} (Discord ID: ${m.discordId})`);
  console.log(`   Servants (${m.servants?.length || 0}): ${m.servants?.map(s => s.template?.name || s.name || s.templateId).join(', ')}`);
});
console.log(`=====================================================\n`);
