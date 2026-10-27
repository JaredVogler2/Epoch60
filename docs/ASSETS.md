# Assets and licenses

- **3D models, textures, icons:** all generated in code in this repository (`src/render/geo.ts`, `src/render/models/*`, `src/render/textures.ts`, `src/ui/icons.tsx`).
  No third-party meshes, textures or icon packs. Original work by this project.
- **Fonts:** system font stacks only (Georgia/Palatino serif for headings; system UI sans). No web fonts, no network requests.
- **Audio:** none shipped as files. Music and effects are synthesised at runtime in `src/game/audio.ts` from oscillators and filtered noise (Web Audio); no samples, no
  third-party music or sound packs, nothing to license. It has not been judged by ear.
- **Runtime dependencies** (MIT): react, react-dom, three, @react-three/fiber, @react-three/drei (installed, not yet imported). See `package.json` for exact versions.
