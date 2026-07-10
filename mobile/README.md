# TrustBite Mobile

Flutter/Dart mobile app for TrustBite.

## Structure

```text
mobile/
├── lib/
│   ├── main.dart
│   └── src/
│       ├── app.dart
│       ├── core/theme/
│       └── features/home/
├── test/
├── analysis_options.yaml
└── pubspec.yaml
```

## Requirements

- Flutter SDK 3.4+
- Dart SDK included with Flutter

## Setup

```bash
cd ..
npm run mobile:pubget
npm run mobile:run
```

Run from the repository root with `npm run mobile:run` when authentication is
enabled. The script forwards the non-secret Cognito region, user pool ID, and
app client ID from `server/.env` to Flutter as `--dart-define` values. Running
`flutter run` directly leaves Cognito unconfigured unless you pass those
`--dart-define` values yourself.

## Generate Platform Runners

This repository currently contains the Flutter source skeleton. If Android/iOS/Web runner files are missing, generate them after installing Flutter:

```bash
cd mobile
flutter create .
```
