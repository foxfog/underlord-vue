# Individual Volume Control Implementation Test

## What was implemented:

1. **Individual Volume Control**: Each audio player now has its own personal volume slider (personalVolume) that ranges from 0 to 1
2. **Combined Volume System**: The final volume applied to each audio element is calculated as: `personalVolume * globalVolume`
3. **Real-time Updates**: Changes to either personal or global volume settings immediately update the audio playback

## How it works:

### Before (Global Only):
- All players shared the same volume setting from the store
- Changing volume on one player affected the global setting for that type (music/sound/voice)
- No individual control per player instance

### After (Individual + Global):
- Each player has its own `personalVolume` (default: 1.0 = 100%)
- Global volume settings still exist and act as multipliers
- Final audio volume = `personalVolume * globalVolume`
- Example: Personal 50% + Global Music 80% = Final 40% volume

## Components affected:

1. **UiPlayerAudio.vue**:
   - Added `personalVolume` ref for individual control
   - Created `globalVolume` computed for store values
   - Created `finalVolume` computed for combined calculation
   - Updated volume sliders to use `personalVolume`
   - Added watchers for real-time updates

## Test scenarios:

1. **Individual Control**: 
   - Each player's volume slider should only affect that specific player
   - Other players should maintain their own volume levels

2. **Global Settings Impact**:
   - Changing global music/sound/voice volume in settings should affect all relevant players
   - But each player should maintain its individual ratio

3. **Combined Effect**:
   - If global music = 50% and player personal = 80%, final volume = 40%
   - Settings page volume changes should immediately update all playing audio

## Usage locations:

- Playground page: Multiple audio players with independent volume controls
- Settings page: Global volume controls that affect all players as multipliers
- Any other location using UiPlayerAudio component