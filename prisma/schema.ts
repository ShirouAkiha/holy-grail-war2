export const prismaSchemaCode = `// Prisma Schema for Holy Grail War Discord Bot
// Datasource: SQLite (development) / PostgreSQL (production)
// Generator: prisma-client-js

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Master {
  id              String         @id @default(uuid())
  discordId       String         @unique
  username        String
  avatarUrl       String?
  saintQuartz     Int            @default(30)
  summonTickets   Int            @default(5)
  commandSeals    Int            @default(3)
  actionPoints    Int            @default(100)
  maxActionPoints Int            @default(100)
  pityCount       Int            @default(0)
  grailWarWins    Int            @default(0)
  lastDailyClaim  DateTime?
  activeServantId String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAction

  servants        MasterServant[]
  inventory       UserCraftEssence[]
  allianceMembers AllianceMember[]
  warLogs         WarActionLog[]
}

model ServantTemplate {
  id              String         @id
  name            String
  title           String
  servantClass    String
  rarity          Int
  baseHp          Int
  baseAtk         Int
  commandDeck     String
  npName          String
  npCardType      String
  npDescription   String
  npChant         String
  summonQuote     String
  battleStartQuote String
  victoryQuote    String
  defeatQuote     String
  avatarUrl       String
  spriteUrl       String?

  instances       MasterServant[]
}

model MasterServant {
  id                  String          @id @default(uuid())
  masterId            String
  templateId          String
  level               Int             @default(1)
  experience          Int             @default(0)
  allocatedStrength   Int             @default(0)
  allocatedEndurance  Int             @default(0)
  allocatedAgility    Int             @default(0)
  allocatedMana       Int             @default(0)
  allocatedLuck       Int             @default(0)
  availableStatPoints Int             @default(0)
  nickname            String?
  customSummonQuote   String?
  customBattleQuote   String?
  customNpChant       String?
  customVictoryQuote  String?
  bondLevel           Int             @default(1)
  equippedCeId        String?

  master              Master          @relation(fields: [masterId], references: [id], onDelete: Cascade)
  template            ServantTemplate @relation(fields: [templateId], references: [id])
}

model CraftEssenceTemplate {
  id          String             @id
  name        String
  rarity      Int
  effectText  String
  hpBonus     Int                @default(0)
  atkBonus    Int                @default(0)
  imageUrl    String
  users       UserCraftEssence[]
}

model UserCraftEssence {
  id        String               @id @default(uuid())
  masterId  String
  ceId      String
  count     Int                  @default(1)

  master    Master               @relation(fields: [masterId], references: [id], onDelete: Cascade)
  template  CraftEssenceTemplate @relation(fields: [ceId], references: [id])
}

model HolyGrailWar {
  id           String           @id @default(uuid())
  title        String
  status       String           @default("lobby")
  currentRound Int              @default(1)
  maxRounds    Int              @default(7)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  alliances    WarAlliance[]
  actionLogs   WarActionLog[]
}

model WarAlliance {
  id        String           @id @default(uuid())
  warId     String
  name      String
  createdAt DateTime         @default(now())

  war       HolyGrailWar     @relation(fields: [warId], references: [id], onDelete: Cascade)
  members   AllianceMember[]
}

model AllianceMember {
  id         String      @id @default(uuid())
  allianceId String
  masterId   String

  alliance   WarAlliance @relation(fields: [allianceId], references: [id], onDelete: Cascade)
  master     Master      @relation(fields: [masterId], references: [id], onDelete: Cascade)
}

model WarActionLog {
  id         String       @id @default(uuid())
  warId      String
  masterId   String
  round      Int
  actionType String
  details    String
  timestamp  DateTime     @default(now())

  war        HolyGrailWar @relation(fields: [warId], references: [id], onDelete: Cascade)
  master     Master       @relation(fields: [masterId], references: [id], onDelete: Cascade)
}
`;
