# ImgDrop Workspace Rules & Invariants

These guidelines apply across all tasks within this repository.

---

## 1. Environment & Build Safety
- **No Local Native Builds**: NEVER run local native Gradle, Xcode, or Android compilation commands (`./gradlew assemble*`, `npx expo run:android`, `expo run:ios`, etc.) on this machine.
- **Cloud / CI Builds Only**: All native APK / binary builds must be executed via GitHub Actions (`.github/workflows/build-android.yml`) or EAS Build.
- **Target Architecture**: Always target `arm64-v8a` architecture (`-PreactNativeArchitectures=arm64-v8a`) to minimize build times and binary size.

---

## 2. Monorepo & Metro Bundling Invariants
- **Bun Workspaces & Hoisting**:
  - In a Bun monorepo, Metro bundler resolves packages strictly from explicit dependencies.
  - Any dynamic runtime package injected by Babel or Expo (including `@babel/runtime`, `@babel/core`, `babel-preset-expo`, `expo-asset`, `expo-font`, `@expo/metro-runtime`, and `expo-modules-core`) MUST be declared explicitly in `apps/mobile/package.json`.
- **Metro Configuration**:
  - `metro.config.js` must watch the monorepo root: `config.watchFolders = [monorepoRoot]`.
  - Node module paths must include both project and root `node_modules`.
  - Always set `config.resolver.disableHierarchicalLookup = true` to prevent Metro from looking in invalid nested paths.
- **Babel Configuration**:
  - Always keep a `babel.config.js` in `apps/mobile` with `presets: ['babel-preset-expo']`.

---

## 3. GitHub Actions Android CI Guidelines
- **Ubuntu Android Runners**:
  - Do NOT use `android-actions/setup-android@v3` (it fails trying to download deprecated `tools`).
  - Rely on the pre-installed Android SDK on `ubuntu-latest` and run `yes | sdkmanager --licenses || true`.
- **Standalone Release APKs**:
  - To produce installable standalone release APKs without requiring a production Play Store keystore, inject an `init.gradle` rule in CI:
    `project.android.buildTypes.release.signingConfig = project.android.signingConfigs.debug`.

---

## 4. Documentation & Agent Workflows
- **Context7 for Documentation**:
  - When researching or retrieving documentation for Expo, React Native, or UI libraries, always use the `context7` MCP server (`resolve-library-id` followed by `query-docs`).
- **Subagent Model Configuration**:
  - When spawning subagents with `invoke_subagent`, always use `Model: 'inherit'` to preserve the user's active model selection.
