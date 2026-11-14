export const VISUAL_STYLES = [
  'Cinematic', 'Abstract', 'Documentary', 'High Energy', 'Pop', 'Rock',
  'Hip Hop', 'Electronic', 'Folk/Acoustic', 'Romantic', 'Melancholic',
  'Psychedelic', 'Film Noir', 'Vaporwave', 'Anime', 'Wes Anderson',
  'Minimalist', 'Gothic', 'Surrealist', 'Horror', 'Thriller', 'Cyberpunk',
  'Steampunk',
]

export const STYLE_AESTHETICS = {
  Cinematic: 'cinematic film aesthetic, anamorphic lens flares, dramatic key lighting, shallow depth of field, teal and orange grade',
  Abstract: 'abstract visual poetry, flowing liquid forms, kaleidoscopic symmetry, macro textures, rhythmic morphing shapes',
  Documentary: 'raw documentary realism, handheld immediacy, natural available light, candid unposed moments, grainy 16mm texture',
  'High Energy': 'explosive kinetic energy, rapid motion blur, strobing light bursts, high-contrast punchy grade, adrenaline pacing',
  Pop: 'glossy pop sheen, candy-colored production design, pristine studio lighting, playful confetti bursts, flawless glamour',
  Rock: 'gritty rock attitude, smoke-filled stage haze, searing backlight silhouettes, sweat and leather texture, high-contrast monochrome flashes',
  'Hip Hop': 'urban hip hop grit, golden-hour city streets, chain-link fence shadows, low-rider chrome reflections, boom-bap visual rhythm',
  Electronic: 'hypnotic electronic visuals, laser grids, LED wall environments, synchronized light pulses, deep bass-reactive motion',
  'Folk/Acoustic': 'warm folk intimacy, sun-dappled woodland clearings, handcrafted textures, soft linen tones, gentle naturalism',
  Romantic: 'romantic dreamlike softness, gauzy diffusion filters, rose-gold hour light, tender close-ups, floating silk fabrics',
  Melancholic: 'melancholic stillness, desaturated blue-grey palette, rain-streaked windows, empty spaces, lingering slow fades',
  Psychedelic: 'psychedelic kaleidoscope, chromatic warping, liquid light show projections, infinite fractal tunnels, saturated acid colors',
  'Film Noir': 'film noir chiaroscuro, venetian blind shadows, cigarette smoke curls, rain-slicked noir streets, femme fatale silhouettes, high-contrast black and white',
  Vaporwave: 'vaporwave nostalgia, magenta and cyan gradients, roman busts and grid horizons, VHS scanlines, glitching sunset chrome',
  Anime: 'anime cel-shaded worlds, speed lines and impact frames, sakura petals drifting, expressive dramatic wind, vivid painted skies',
  'Wes Anderson': 'meticulous Wes Anderson symmetry, pastel production design, centered dollhouse framing, planimetric tracking shots, storybook whimsy',
  Minimalist: 'minimalist negative space, single-subject isolation, clean geometric compositions, restrained monochrome palette, quiet precision',
  Gothic: 'dark gothic aesthetic, towering cathedral arches, misty fog rolling across cobblestones, silver moonlight illumination, baroque Victorian drapery, moody chiaroscuro lighting, brooding atmospheric depth, romantic macabre fantasy',
  Surrealist: 'surrealist impossible geometry, melting horizons, doorways opening onto skies, dream logic juxtapositions, Dali-esque scale distortions',
  Horror: 'horror dread atmosphere, flickering practical lights, peeling wallpaper decay, wrong-angle shadows, creeping slow reveals',
  Thriller: 'tense thriller paranoia, cold steel-blue grade, claustrophobic framing, surveillance-camera textures, coiled spring tension',
  Cyberpunk: 'cyberpunk neon dystopia, rain-slicked megacity alleys, holographic advertisements, cybernetic augmentations, electric magenta and cyan glow',
  Steampunk: 'steampunk brass machinery, hissing steam vents, gear-driven contraptions, sepia Victorian elegance, gaslight amber warmth',
}

export const CAMERA_ANGLES = [
  'Low angle tracking shot',
  'High angle overhead view',
  'Eye-level close-up',
  'Wide cinematic landscape shot',
  'Dynamic whip-pan shot',
  'Slow dolly push-in',
  'Dutch angle perspective',
]

export const TRANSITIONS = [
  'Cut to:', 'Dissolve to:', 'Fade in:', 'Match cut to:', 'Flash to:', 'Whip pan to:',
]

export const MARKER_COLORS = [
  'Blue', 'Cyan', 'Green', 'Yellow', 'Red', 'Pink', 'Purple', 'Fuchsia',
]

export const DIRECTOR_ENGINE_CHARACTERS = [
  { name: 'The Protagonist', description: 'A compelling central figure whose journey anchors the narrative' },
]

export const DIRECTOR_ENGINE_PROPS = [
  { name: 'The Mysterious Relic', description: 'An enigmatic object of significance that recurs throughout the video' },
]

export const PROMPT_LIBRARY_PRESETS = [
  { id: 'pl-cinematic-35mm', title: 'Cinematic 35mm', description: 'Classic anamorphic film look with organic grain', tags: ['35mm', 'anamorphic', 'film grain'], category: 'Camera & Film Stock', promptSnippet: 'shot on 35mm anamorphic film, shallow depth of field, organic film grain, cinematic color science', negativePrompt: 'digital noise, oversharpening, flat lighting', cameraNotes: 'Anamorphic widescreen, motivated handheld', lightingNotes: 'Motivated practical sources', colorPaletteHints: ['#0D1B2A', '#415A77', '#E0E1DD'], isCustom: false, isFavorite: true },
  { id: 'pl-noir-bw', title: 'Noir Black & White', description: 'High-contrast monochrome detective atmosphere', tags: ['noir', 'monochrome'], category: 'Genre & Mood', promptSnippet: 'high-contrast black and white cinematography, deep blacks, venetian blind shadows, cigarette smoke haze', negativePrompt: 'color, cheerful lighting', cameraNotes: 'Dutch angles, hard focus pulls', lightingNotes: 'Single hard key, deep falloff', colorPaletteHints: ['#000000', '#FFFFFF', '#555555'], isCustom: false, isFavorite: false },
  { id: 'pl-golden-hour', title: 'Golden Hour Glow', description: 'Warm sunset rim light and long shadows', tags: ['golden hour', 'warm'], category: 'Lighting & Atmosphere', promptSnippet: 'warm golden hour sunlight, long dramatic shadows, sun flare, honey-toned highlights', negativePrompt: 'overcast, flat midday light', cameraNotes: 'Backlit silhouettes, wide vistas', lightingNotes: 'Natural low sun', colorPaletteHints: ['#FFB703', '#FB8500', '#8ECAE6'], isCustom: false, isFavorite: true },
  { id: 'pl-neon-night', title: 'Neon Night Streets', description: 'Rain-slicked urban nightscape drenched in neon', tags: ['neon', 'cyberpunk', 'night'], category: 'Lighting & Atmosphere', promptSnippet: 'neon-soaked night streets, wet asphalt reflections, magenta and cyan practical lights, atmospheric haze', negativePrompt: 'daylight, rural setting', cameraNotes: 'Low tracking through alleys', lightingNotes: 'Neon signage as key light', colorPaletteHints: ['#FF007F', '#00E5FF', '#12002E'], isCustom: false, isFavorite: true },
  { id: 'pl-vhs-retro', title: 'VHS Retro 80s', description: 'Magnetic tape nostalgia with scanlines', tags: ['vhs', 'retro', '80s'], category: 'Aesthetic / Art Style', promptSnippet: '1980s VHS tape aesthetic, chromatic aberration, scanlines, timestamp overlay, magnetic wobble', negativePrompt: 'clean digital, 4k sharpness', cameraNotes: 'Zoom-heavy period framing', lightingNotes: 'Hot spotlights, haze', colorPaletteHints: ['#2B0033', '#FF71CE', '#01CDFE'], isCustom: false, isFavorite: false },
  { id: 'pl-anime-cel', title: 'Anime Cel Shade', description: 'Hand-drawn animation energy', tags: ['anime', 'cel shaded'], category: 'Aesthetic / Art Style', promptSnippet: 'cel-shaded anime style, bold ink outlines, speed lines, dramatic wind-blown hair, painted background skies', negativePrompt: 'photorealistic, live action', cameraNotes: 'Impact frames, dynamic tilts', lightingNotes: 'Stylized rim light', colorPaletteHints: ['#FF6B9D', '#4ECDC4', '#FFE66D'], isCustom: false, isFavorite: false },
  { id: 'pl-brutal-light', title: 'Brutal Hard Light', description: 'Uncompromising direct flash aesthetic', tags: ['hard light', 'editorial'], category: 'Lighting & Atmosphere', promptSnippet: 'harsh direct on-camera flash, blown highlights, deep hard shadows, editorial fashion edge', negativePrompt: 'soft diffused light', cameraNotes: 'Snap zooms, centered subject', lightingNotes: 'Bare bulb / speedlight', colorPaletteHints: ['#FFFFFF', '#111111', '#FF3131'], isCustom: false, isFavorite: false },
  { id: 'pl-dream-soft', title: 'Dream Soft Focus', description: 'Diffusion-filtered romantic reverie', tags: ['dreamy', 'soft focus'], category: 'Lighting & Atmosphere', promptSnippet: 'soft pro-mist diffusion, glowing halation, gauzy romantic bloom, floating dust motes in light beams', negativePrompt: 'clinical sharpness', cameraNotes: 'Slow drifting moves', lightingNotes: 'Backlit haze', colorPaletteHints: ['#F8EDEB', '#FFD7BA', '#CEE5D0'], isCustom: false, isFavorite: false },
  { id: 'pl-doc-handheld', title: 'Doc Handheld', description: 'Run-and-gun documentary immediacy', tags: ['documentary', 'handheld'], category: 'Camera & Film Stock', promptSnippet: 'handheld documentary camera work, natural available light, candid framing, subtle sensor shake', negativePrompt: 'tripod smoothness, stagey posing', cameraNotes: 'Shoulder-mounted follow', lightingNotes: 'Whatever exists on location', colorPaletteHints: ['#6B705C', '#CB997E', '#FFE8D6'], isCustom: false, isFavorite: false },
  { id: 'pl-high-energy-cut', title: 'High Energy Strobe', description: 'Beat-synced explosive cutting energy', tags: ['energetic', 'strobe'], category: 'Genre & Mood', promptSnippet: 'explosive kinetic energy, strobe light bursts, whip-fast camera moves, motion-blurred limbs, punchy contrast', negativePrompt: 'slow static shots', cameraNotes: 'Whip pans, crash zooms', lightingNotes: 'Strobes and blinders', colorPaletteHints: ['#FF206E', '#FBFF12', '#41EAD4'], isCustom: false, isFavorite: false },
  { id: 'pl-pastel-symmetry', title: 'Pastel Symmetry', description: 'Storybook centered compositions', tags: ['pastel', 'symmetry', 'wes anderson'], category: 'Aesthetic / Art Style', promptSnippet: 'perfectly symmetrical centered composition, pastel production design, planimetric staging, deadpan whimsy', negativePrompt: 'chaos, handheld shake', cameraNotes: 'Locked-off symmetrical frames, lateral pans', lightingNotes: 'Even, theatrical', colorPaletteHints: ['#F9CBD3', '#A2D2FF', '#FDF6E3'], isCustom: false, isFavorite: false },
  { id: 'pl-horror-dread', title: 'Horror Dread', description: 'Creeping unease and wrong shadows', tags: ['horror', 'dread'], category: 'Genre & Mood', promptSnippet: 'creeping dread atmosphere, flickering practicals, oppressive darkness eating frame edges, unsettling negative space', negativePrompt: 'bright cheerful tones', cameraNotes: 'Slow creeping push-ins', lightingNotes: 'Failing practicals, underexposure', colorPaletteHints: ['#0B090A', '#660708', '#BA181B'], isCustom: false, isFavorite: false },
  { id: 'pl-vaporwave', title: 'Vaporwave Dream', description: 'A E S T H E T I C grid horizons', tags: ['vaporwave', 'glitch'], category: 'Aesthetic / Art Style', promptSnippet: 'vaporwave aesthetic, magenta-to-cyan gradient sky, wireframe grid horizon, roman bust imagery, glitch artifacts', negativePrompt: 'naturalism', cameraNotes: 'Slow dolly toward horizon', lightingNotes: 'Self-lit neon environment', colorPaletteHints: ['#FF71CE', '#01CDFE', '#05FFA1'], isCustom: false, isFavorite: false },
  { id: 'pl-epic-crane', title: 'Epic Crane Reveal', description: 'Sweeping large-format grandeur', tags: ['epic', 'crane', 'large format'], category: 'Camera & Film Stock', promptSnippet: 'large format 65mm cinematography, sweeping crane reveal, epic scale landscape, immense depth, pristine detail', negativePrompt: 'claustrophobic framing', cameraNotes: 'Crane / drone ascent reveal', lightingNotes: 'Grand natural light', colorPaletteHints: ['#3A5A40', '#A3B18A', '#DAD7CD'], isCustom: false, isFavorite: false },
]
