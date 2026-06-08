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
cd mobile
flutter pub get
flutter run
```

## Generate Platform Runners

This repository currently contains the Flutter source skeleton. If Android/iOS/Web runner files are missing, generate them after installing Flutter:

```bash
cd mobile
flutter create .
```
