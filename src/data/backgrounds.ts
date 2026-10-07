export interface BackgroundPreset {
  id: string;
  name: string;
  description: string;
  url: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'fuyuki_burning',
    name: 'Fuyuki City — Infernal Ruins',
    description: 'Blazing ruins of Fuyuki on Fire',
    url: 'https://ella.janitorai.com/media-approved/jY-GN1VKq3UlnavhY6OaT.webp'
  },
  {
    id: 'misaki_walkway',
    name: 'Misaki Town — Suburban Walkway',
    description: 'Quiet tree-lined walkway in Misaki Town',
    url: 'https://ella.janitorai.com/media-approved/dITJqob8_4CTn3wm78Rar.webp'
  },
  {
    id: 'misaki_avenue',
    name: 'Misaki Town — Residential District',
    description: 'Serene residential avenue at dusk',
    url: 'https://ella.janitorai.com/media-approved/7Mhx1ql6Pp3AtYPB6w-h_.webp'
  },
  {
    id: 'winter_forest',
    name: 'Kuwakami Forest — Twilight Snow',
    description: 'Mystic winter forest bathed in twilight',
    url: 'https://ella.janitorai.com/media-approved/viHXGeGPUA8wH2vCa3WqJ.webp'
  },
  {
    id: 'winter_street',
    name: 'Misaki Heights — Snowbound Avenue',
    description: 'Snow-covered urban avenue at nightfall',
    url: 'https://ella.janitorai.com/media-approved/VUK_S0ltXOxo08sI3apYa.webp'
  },
  {
    id: 'rainy_promenade',
    name: 'Commercial Promenade — Rain Reflections',
    description: 'Rain-soaked walkway with glistening reflections',
    url: 'https://ella.janitorai.com/media-approved/YEdeIWthJTVcOAw2M5Ldg.webp'
  },
  {
    id: 'night_overlook',
    name: 'Hillside Highway — Night Cityscape',
    description: 'Night highway overlooking the illuminated city',
    url: 'https://ella.janitorai.com/media-approved/qGyOU6LDrhkfgxVTj8joK.webp'
  }
];

export function getRandomBackgroundUrl(): string {
  const idx = Math.floor(Math.random() * BACKGROUND_PRESETS.length);
  return BACKGROUND_PRESETS[idx].url;
}

export function findBackgroundPreset(idOrName?: string): BackgroundPreset | undefined {
  if (!idOrName) return undefined;
  const lower = idOrName.toLowerCase().trim();
  return BACKGROUND_PRESETS.find(p => p.id === lower || p.name.toLowerCase().includes(lower) || lower.includes(p.id));
}
