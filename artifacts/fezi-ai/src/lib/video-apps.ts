export type VideoApp = {
  id: string;
  name: string;
  description: string;
  dailyLimit: number;
  creditCost: number;
  requiresSubscription?: boolean;
};

export const videoAppCatalog: VideoApp[] = [
  { id: 'wan-2.1', name: 'Wan 2.1', description: 'Short motion preview from a keyframe. Native provider generation is not connected.', dailyLimit: 2, creditCost: 70 },
  { id: 'seedance', name: 'Seedance', description: 'Premium Seedance video generation workflow.', dailyLimit: 1, creditCost: 640, requiresSubscription: true },
  { id: 'wan-2.2', name: 'Wan 2.2', description: 'Open text-to-video and image-to-video direction. Preview limits apply.', dailyLimit: 1, creditCost: 79 },
  { id: 'wan-2.5', name: 'Wan 2.5', description: 'Higher-quality Wan motion and scene generation. Preview limits apply.', dailyLimit: 1, creditCost: 85 },
  { id: 'sora-2', name: 'Sora 2', description: 'Storyboard-led video concept workspace. Preview limits apply.', dailyLimit: 1, creditCost: 650 },
  { id: 'kling-1.6', name: 'Kling 1.6', description: 'Text-to-video and image-to-video direction. Preview limits apply.', dailyLimit: 1, creditCost: 180 },
  { id: 'kling-2.0', name: 'Kling 2.0', description: 'Directed character and scene animation.', dailyLimit: 1, creditCost: 200 },
  { id: 'kling-2.1', name: 'Kling 2.1', description: 'Cinematic motion with stronger prompt control.', dailyLimit: 1, creditCost: 220 },
  { id: 'kling-2.5', name: 'Kling 2.5 Turbo', description: 'Fast Kling video generation and iteration.', dailyLimit: 1, creditCost: 230 },
  { id: 'veo-2', name: 'Google Veo 2', description: 'Cinematic generative video direction.', dailyLimit: 1, creditCost: 260 },
  { id: 'veo-3', name: 'Google Veo 3', description: 'High-fidelity scene and camera direction.', dailyLimit: 1, creditCost: 265 },
  { id: 'runway-gen3', name: 'Runway Gen-3', description: 'Generative video and shot iteration.', dailyLimit: 1, creditCost: 190 },
  { id: 'runway-gen4', name: 'Runway Gen-4', description: 'Consistent characters and cinematic shot design.', dailyLimit: 1, creditCost: 200 },
  { id: 'luma-ray2', name: 'Luma Ray 2', description: 'Fast scene and motion exploration.', dailyLimit: 1, creditCost: 110 },
  { id: 'luma-dream-machine', name: 'Luma Dream Machine', description: 'Creative text-to-video and image-to-video concepts.', dailyLimit: 1, creditCost: 130 },
  { id: 'hailuo-01', name: 'Hailuo 01', description: 'Short-form video and character motion concepts.', dailyLimit: 1, creditCost: 320 },
  { id: 'hailuo-02', name: 'Hailuo 02', description: 'Hailuo motion direction with longer scene ideas.', dailyLimit: 1, creditCost: 350 },
  { id: 'minimax-video-01', name: 'MiniMax Video-01', description: 'Prompt-led short video creation.', dailyLimit: 1, creditCost: 250 },
  { id: 'pika-1.5', name: 'Pika 1.5', description: 'Social video effects and quick concepts.', dailyLimit: 1, creditCost: 180 },
  { id: 'pika-2.0', name: 'Pika 2', description: 'Creative video edits, effects, and transformations.', dailyLimit: 1, creditCost: 235 },
  { id: 'pixverse-v3', name: 'PixVerse V3', description: 'Template-aware short video ideation.', dailyLimit: 1, creditCost: 380 },
  { id: 'pixverse-v4', name: 'PixVerse V4', description: 'High-quality social and cinematic video concepts.', dailyLimit: 1, creditCost: 420 },
  { id: 'vidu-q1', name: 'Vidu Q1', description: 'Fast text-to-video and image-to-video workflows.', dailyLimit: 1, creditCost: 210 },
  { id: 'vidu-2', name: 'Vidu 2', description: 'Character and scene motion generation.', dailyLimit: 1, creditCost: 211 },
  { id: 'haiper', name: 'Haiper', description: 'Stylized motion and creative video drafts.', dailyLimit: 1, creditCost: 329 },
  { id: 'stable-video-diffusion', name: 'Stable Video Diffusion', description: 'Open image-to-video motion generation.', dailyLimit: 1, creditCost: 120 },
  { id: 'cogvideox', name: 'CogVideoX', description: 'Open text-to-video research workflow.', dailyLimit: 1, creditCost: 190 },
  { id: 'mochi-1', name: 'Mochi 1', description: 'Open motion and scene generation.', dailyLimit: 1, creditCost: 260 },
  { id: 'hunyuan-video', name: 'HunyuanVideo', description: 'Open cinematic text-to-video direction.', dailyLimit: 1, creditCost: 240 },
  { id: 'ltx-video', name: 'LTX-Video', description: 'Fast video drafts.', dailyLimit: 1, creditCost: 300 },
  { id: 'ltxv-13b', name: 'LTXV 13B', description: 'Open long-context video generation direction.', dailyLimit: 1, creditCost: 333 },
  { id: 'animatediff', name: 'AnimateDiff', description: 'Animate still images with controlled motion.', dailyLimit: 1, creditCost: 200 },
  { id: 'animatediff-lightning', name: 'AnimateDiff Lightning', description: 'Fast animated image and motion drafts.', dailyLimit: 1, creditCost: 210 },
  { id: 'opensora', name: 'Open-Sora', description: 'Open video research and scene generation.', dailyLimit: 1, creditCost: 450 },
  { id: 'videocrafter', name: 'VideoCrafter', description: 'Open text-to-video and image-to-video concepts.', dailyLimit: 1, creditCost: 320 },
  { id: 'modelscope-t2v', name: 'ModelScope Text-to-Video', description: 'Open text-to-video generation workflow.', dailyLimit: 1, creditCost: 280 },
  { id: 'i2vgen-xl', name: 'I2VGen-XL', description: 'High-resolution image-to-video direction.', dailyLimit: 1, creditCost: 333 },
  { id: 'firefly-video', name: 'Adobe Firefly Video', description: 'Commercial video and b-roll direction.', dailyLimit: 1, creditCost: 650 },
  { id: 'movie-gen', name: 'Meta Movie Gen', description: 'Long-form scene and story concept direction.', dailyLimit: 1, creditCost: 850 },
  { id: 'canva-magic-media', name: 'Canva Magic Media', description: 'Social and presentation video concepts.', dailyLimit: 1, creditCost: 530 },
  { id: 'invideo-ai', name: 'InVideo AI', description: 'Script-to-video and social content planning.', dailyLimit: 1, creditCost: 250 },
  { id: 'capcut-ai', name: 'CapCut AI', description: 'Short-form edits, effects, and social video ideas.', dailyLimit: 1, creditCost: 450 },
  { id: 'heygen', name: 'HeyGen', description: 'Avatar-led presentation and spokesperson video direction.', dailyLimit: 1, creditCost: 480 },
  { id: 'synthesia', name: 'Synthesia', description: 'Presenter and training video concepts.', dailyLimit: 1, creditCost: 420 },
  { id: 'd-id', name: 'D-ID', description: 'Talking-avatar and image-to-video direction.', dailyLimit: 1, creditCost: 310 },
  { id: 'genmo', name: 'Genmo', description: 'Creative motion and scene exploration.', dailyLimit: 1, creditCost: 300 },
  { id: 'kaiber', name: 'Kaiber', description: 'Music-video and stylized motion concepts.', dailyLimit: 1, creditCost: 280 },
  { id: 'krea-video', name: 'Krea Video', description: 'Real-time creative video exploration.', dailyLimit: 1, creditCost: 480 },
];