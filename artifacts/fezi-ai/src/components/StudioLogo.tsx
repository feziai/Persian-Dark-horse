import { Camera, Code2, Film, Mic2 } from 'lucide-react';

export type StudioId = 'video' | 'image' | 'code' | 'voice';

export const studioMeta: Record<StudioId, {
  titleKey: 'studio_video_title' | 'studio_image_title' | 'studio_code_title' | 'studio_voice_title';
  descKey: 'studio_video_desc' | 'studio_image_desc' | 'studio_code_desc' | 'studio_voice_desc';
  color: string;
  icon: typeof Film;
  initials: string;
  requiresSubscription: boolean;
  hasPaidTools: boolean;
}> = {
  video: { titleKey: 'studio_video_title', descKey: 'studio_video_desc', color: '#ec73cf', icon: Film, initials: 'MV', requiresSubscription: false, hasPaidTools: true },
  image: { titleKey: 'studio_image_title', descKey: 'studio_image_desc', color: '#68c8ff', icon: Camera, initials: 'PX', requiresSubscription: false, hasPaidTools: true },
  code: { titleKey: 'studio_code_title', descKey: 'studio_code_desc', color: '#73e0bd', icon: Code2, initials: '</>', requiresSubscription: true, hasPaidTools: false },
  voice: { titleKey: 'studio_voice_title', descKey: 'studio_voice_desc', color: '#f5a86b', icon: Mic2, initials: 'VO', requiresSubscription: true, hasPaidTools: true },
};

export function StudioLogo({ studioId, compact = false }: { studioId: StudioId; compact?: boolean }) {
  const meta = studioMeta[studioId];
  const Icon = meta.icon;
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}
      style={{
        color: meta.color,
        borderColor: `${meta.color}55`,
        background: `radial-gradient(circle at 30% 20%, ${meta.color}35, transparent 55%), linear-gradient(145deg, ${meta.color}18, transparent)`,
      }}
      aria-hidden="true"
    >
      <div className="absolute -end-3 -top-3 h-8 w-8 rounded-full border opacity-40" style={{ borderColor: meta.color }} />
      <div className="absolute -bottom-5 -start-4 h-10 w-10 rounded-full border opacity-30" style={{ borderColor: meta.color }} />
      <Icon size={compact ? 20 : 27} strokeWidth={1.8} className="relative z-10" />
      {!compact && <span className="absolute bottom-1 end-1 text-[7px] font-bold tracking-widest opacity-80">{meta.initials}</span>}
    </div>
  );
}