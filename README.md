# underlord

An Electron application with Vue

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Data Structure

The project uses JSON files for tile and object definitions:
- Tile data: `src/renderer/components/game/tiles/tiles.json`
- Object data: `src/renderer/components/game/tiles/objects.json`

Each tile and object now includes explicit `id`, `type`, and `tags` fields for better data management and CSS manipulation.
See `src/renderer/components/game/tiles/README.md` for detailed documentation.