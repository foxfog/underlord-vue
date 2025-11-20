# Location Character Placement System

## Overview
This document explains how to place characters on locations using JSON data. The system allows for flexible character placement on any tile within a location.

## Location JSON Structure

Locations can now include a `characters` array that defines which characters should appear at specific coordinates:

```json
{
  "id": "location-id",
  "name": "Location Name",
  "characters": [
    {
      "id": "character-id",
      "cord": [x, y]
    }
  ]
}
```

## Example

```json
{
  "id": "mc-apartment",
  "name": "MC Apartment",
  "characters": [
    {
      "id": "mc",
      "cord": [0, 0]
    },
    {
      "id": "ainz",
      "cord": [0, -6]
    }
  ]
}
```

## How It Works

1. The location loader reads the `characters` array from the location JSON
2. The `LocationIso.vue` component uses the `getCharactersOnTile(x, y)` function to determine which characters are on each tile
3. Characters are rendered using the `TileChar.vue` component
4. Character images are loaded from `/images/char/{character-id}/tile/char.png` or fallback to a default image

## Adding Characters to Locations

To add characters to a location:

1. Add a `characters` array to the location JSON
2. For each character, specify:
   - `id`: The character ID (must match a character in `/data/characters/`)
   - `cord`: An array with [x, y] coordinates

## Character Data Structure

Character data is stored in `/data/characters/{character-id}.json` and can include image paths:

```json
{
  "character-id": {
    "name": "Character Name",
    "tile": {
      "front": {
        "body": {
          "torso": "/images/char/character-id/tile/char.png"
        }
      }
    }
  }
}