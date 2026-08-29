import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Holy Grail War Discord RPG',
  description: 'Modular Discord bot and RPG game engine featuring gacha summoning, servant customization, turn-based combat with Buster/Arts/Quick cards, Holy Grail War battle-royale events, and high-performance Canvas card rendering.',
  openGraph: {
    title: 'Holy Grail War Discord RPG',
    description: 'Modular Discord bot and RPG game engine featuring gacha summoning, servant customization, turn-based combat with Buster/Arts/Quick cards, Holy Grail War battle-royale events, and high-performance Canvas card rendering.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Holy Grail War Discord RPG',
    description: 'Modular Discord bot and RPG game engine featuring gacha summoning, servant customization, turn-based combat with Buster/Arts/Quick cards, Holy Grail War battle-royale events, and high-performance Canvas card rendering.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
