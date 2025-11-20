# Underlord

## Description

Underlord is a 2D isometric RPG game built with Electron, Vue 3, and Vite.

## Features

- Isometric game world rendering
- Interactive dialogue system
- Location editor
- Save/load functionality
- Multi-language support (English/Russian)

## Data Structure

The project uses JSON files for tile and object definitions:
- Tile data: `src/renderer/public/data/tiles/tiles.json`
- Object data: `src/renderer/public/data/tiles/objects.json`

Each tile and object now includes explicit `id`, `type`, and `tags` fields for better data management and CSS manipulation.
See `src/renderer/public/data/tiles/README.md` for detailed documentation.

## Development

### Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

### Project Setup

```bash
npm install
```

### Compile and Hot-Reload for Development

```bash
npm run dev
```

### Compile and Minify for Production

```bash
npm run build
```

### Build Application

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```