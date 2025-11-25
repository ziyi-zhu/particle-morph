# Particle Morph

A 3D particle morphing visualization that transforms between different point cloud models with interactive controls.

## Features

- 🎨 **Dynamic Particle Colors**: Randomized colors creating star/universe effects
- 🔄 **Smooth Morphing**: Seamless transitions between 5 different 3D models
- 🖱️ **Interactive Controls**: Drag to rotate, scroll to morph between shapes
- 🎭 **Chaos Mode**: Particles expand from form into chaos and back
- 🌈 **Color Picker**: Choose base colors with automatic complementary variations

## Run Locally

**Prerequisites:** Node.js and pnpm

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the development server:
   ```bash
   pnpm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Build for Production

```bash
pnpm run build
```

The built files will be in the `dist` directory.

## Deploy to GitHub Pages

This project is configured to automatically deploy to GitHub Pages when you push to the `main` branch.

### Setup:

1. Go to your repository settings
2. Navigate to **Pages** section
3. Under **Source**, select "GitHub Actions"
4. Push to the `main` branch to trigger deployment

The repository is configured for deployment at `https://yourusername.github.io/particle-morph/`

## Technologies

- React + TypeScript
- Three.js for 3D rendering
- Vite for build tooling
- Tailwind CSS for styling
- Lucide React for icons
