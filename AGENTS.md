# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 app for a Home Assistant iframe panel showing EV charging stations in Thailand.

- `app/` contains App Router pages, layout, global CSS, and API routes. `app/api/stations/route.ts` is the server-side TomTom proxy.
- `components/` contains UI and map features. `components/EVMap.tsx` is the browser-only map view; `components/EVMapWrapper.tsx` dynamically imports it with SSR disabled.
- `components/ui/` contains reusable shadcn-style primitives, including the MapLibre map wrapper.
- `lib/` contains integration code and utilities, especially `lib/tomtom.ts`.
- `types/` contains shared TypeScript domain types.
- `public/` contains static assets.

## Build, Test, and Development Commands

Use Yarn because this repo includes `yarn.lock`.

```bash
yarn dev          # start local dev server at http://localhost:3000
yarn build        # create a production build and run Next.js type checks
yarn start        # serve the production build
yarn lint         # run ESLint
yarn tsc --noEmit # run TypeScript checks only
```

Set `TOMTOM_API_KEY` in `.env.local` before using station search. Keep it server-side only; do not expose it to client components.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and strict types. Prefer the `@/` path alias for local imports. Keep browser-only code behind `'use client'`, and do not access `window`, `navigator`, MapLibre, or geolocation from Server Components.

Component files use PascalCase, for example `EVMap.tsx` and `FilterBar.tsx`. Utility and integration files use lowercase names, for example `lib/tomtom.ts`. Follow the existing style: two-space indentation, single quotes, no semicolons, Tailwind classes inline for styling.

## Testing Guidelines

No dedicated test framework is currently configured. Before submitting changes, run:

```bash
yarn lint
yarn tsc --noEmit
yarn build
```

For map or geolocation changes, manually verify loading, station fetching, connector filtering, style switching, and denied-location behavior in the browser.

## Commit & Pull Request Guidelines

Git history currently contains only the initial Create Next App commit, so use simple imperative commit messages such as `Add station filter controls` or `Fix TomTom bbox validation`.

Pull requests should include a short description, the commands run, screenshots for UI changes, and notes for any Home Assistant iframe or environment-variable impact.

## Agent-Specific Instructions

This project uses a newer Next.js version. Before changing Next.js APIs, read the relevant guide under `node_modules/next/dist/docs/` and follow current deprecation guidance.
