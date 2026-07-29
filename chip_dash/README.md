# Chip Dash 🎰

A tiny Flutter arcade prototype — a Flappy-Bird-style game where you flap a
**poker chip** through gaps in the felt. A lightweight companion prototype to the
Planning Poker project, built to explore a mobile (Android/iOS) game in Flutter.

Everything is drawn with `CustomPainter`, so there are **no image assets** — the
whole project is a handful of Dart files.

## Run it

You need the [Flutter SDK](https://docs.flutter.dev/get-started/install)
installed. Then, from this folder:

```bash
# One-time: generate the platform folders (android/, ios/, web/, …).
# They are gitignored so the repo stays lean.
flutter create .

flutter pub get

# Pick a target:
flutter run                # whatever device/emulator is connected
flutter run -d chrome      # quickest smoke test, runs in the browser
flutter run -d android     # Android emulator or device
flutter run -d ios         # iOS simulator (needs a Mac + Xcode)
```

> `flutter create .` only scaffolds the missing native folders; it will not
> overwrite anything in `lib/`.

## How to play

- **Tap** anywhere to flap upward.
- Fly through the gaps between the red pipes — each one you clear scores a point.
- Hitting a pipe, the ground, or the ceiling ends the run.
- Your best score is saved between sessions (`shared_preferences`).

## Code layout

| File                   | Responsibility                                              |
| ---------------------- | ----------------------------------------------------------- |
| `lib/main.dart`        | App entry point + theme.                                    |
| `lib/game_screen.dart` | Game loop, physics, collisions, scoring, and the UI overlay.|
| `lib/game_painter.dart`| All the vector drawing (background, pipes, ground, chip).   |
| `lib/pipe.dart`        | The obstacle model.                                         |

## Tuning the feel

The constants at the top of `_GameScreenState` in `game_screen.dart` control the
game's difficulty and feel — gravity, jump strength, scroll speed, gap size, and
pipe spacing. Tweak them to make the game easier or harder.

## Building a release

```bash
flutter build apk            # Android (needs the Android SDK)
flutter build appbundle      # Android, for the Play Store
flutter build ios            # iOS (needs a Mac + Xcode + Apple Developer account)
```
