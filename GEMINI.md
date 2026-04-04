# GEMINI.md - Project Context

## Project Overview
This project, **PhotoTimelimeCollage** (branded in the UI as **Timelapse Aligner**), is a React-based web application for aligning series of images. It is specifically designed to help users precisely overlay handheld photos for the purpose of creating smooth timelapse sequences.

### Core Technologies
- **Frontend Framework:** React 19 (TypeScript)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4 (using the `@tailwindcss/vite` plugin)
- **Icons:** Lucide React
- **GIF Generation:** [gifshot](https://github.com/yahoo/gifshot) (loaded dynamically via CDN)
- **Deployment:** GitHub Pages (via the `gh-pages` package)

## Key Functionalities
- **Image Sources:** Upload local files or capture photos directly via the system camera.
- **Alignment Editor:** 
  - Set a "Fix" image as a static reference point.
  - Manually align other images using translation (drag), rotation, and scaling.
  - **Auto-Align:** Implements a multi-scale area matching algorithm for automated alignment to the reference image.
  - **Overlay Mode:** Adjustable opacity and an "Edge-Detect" filter (SVG-based) for precise visual control during alignment.
- **Export Options:**
  - **Collage:** Generates a wide JPEG image showing all aligned photos side-by-side.
  - **GIF:** Creates an animated timelapse with optional fading and deflickering (brightness normalization).

## Available Commands
- `npm run dev`: Starts the development server.
- `npm run build`: Compiles the project for production.
- `npm run lint`: Runs ESLint for code analysis.
- `npm run deploy`: Builds the project and deploys it to GitHub Pages.

## Development Conventions
- **Structure:** The core application logic resides primarily within `src/App.tsx`.
- **Styling:** Uses Tailwind CSS v4 utility classes directly in JSX.
- **State Management:** Utilizes standard React Hooks (`useState`, `useRef`, `useEffect`).
- **Mathematics:** Transformations are calculated using fractions (`xFrac`, `yFrac`) relative to the container width to ensure responsiveness across different screen sizes.

## Known Dependencies & External Resources
- The `gifshot` library is loaded via `cdnjs.cloudflare.com` within the `useEffect` hook in `App.tsx`.
- Tailwind v4 is configured via the Vite plugin in `vite.config.ts`.
