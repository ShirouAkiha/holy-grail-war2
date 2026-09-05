import { MasterServantInstance } from '../types';
import { allocateStatPoints } from './customization';

export { allocateStatPoints };

export function calculateServantMaxHp(servant: MasterServantInstance | any): number {
  if (!servant) return 14000;
  const baseHp = servant.template?.baseHp || servant.baseHp || 14000;
  const level = servant.level || 1;
  const end = servant.allocatedStats?.endurance || 0;
  const ceHp = servant.equippedCe?.hpBonus || 0;
  return baseHp + (level * 150) + (end * 200) + ceHp;
}

export function calculateServantMaxAtk(servant: MasterServantInstance | any): number {
  if (!servant) return 11000;
  const baseAtk = servant.template?.baseAtk || servant.baseAtk || 11000;
  const level = servant.level || 1;
  const str = servant.allocatedStats?.strength || 0;
  const ceAtk = servant.equippedCe?.atkBonus || 0;
  return baseAtk + (level * 120) + (str * 150) + ceAtk;
}
