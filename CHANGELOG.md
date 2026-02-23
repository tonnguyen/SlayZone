# Changelog


## v0.1.61...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.61...main)

### 🩹 Fixes

- **ci:** Commit convex _generated types for build typecheck ([7cbd9e6](https://github.com/debuglebowski/SlayZone/commit/7cbd9e6))

### ❤️ Contributors

- Debuglebowski




## v0.1.60...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.60...main)

### 🩹 Fixes

- **ci:** Add @types/node to root and convex tsconfig for process.env ([2c3728f](https://github.com/debuglebowski/SlayZone/commit/2c3728f))

### ❤️ Contributors

- Debuglebowski




## v0.1.59...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.59...main)

### 🩹 Fixes

- **ci:** Add @auth/core to root deps for convex deploy ([920eea1](https://github.com/debuglebowski/SlayZone/commit/920eea1))

### ❤️ Contributors

- Debuglebowski




## v0.1.58...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.58...main)

### 🩹 Fixes

- **ci:** Add @convex-dev/auth to root deps for convex deploy ([931caff](https://github.com/debuglebowski/SlayZone/commit/931caff))

### ❤️ Contributors

- Debuglebowski




## v0.1.57...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.57...main)

### 🩹 Fixes

- **ci:** Remove --prod flag from convex deploy ([84d2394](https://github.com/debuglebowski/SlayZone/commit/84d2394))

### ❤️ Contributors

- Debuglebowski




## v0.1.56...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.56...main)

### 🚀 Enhancements

- **mcp:** Add get_current_task_id and create_subtask tools ([1796cfc](https://github.com/debuglebowski/SlayZone/commit/1796cfc))
- **telemetry:** Make heartbeat foreground-aware and add active-time background event ([1a2bd62](https://github.com/debuglebowski/SlayZone/commit/1a2bd62))
- **task:** Add Processes panel for background process management ([422d3b0](https://github.com/debuglebowski/SlayZone/commit/422d3b0))
- **leaderboard:** Daily stats pipeline with ccusage + real Convex queries ([a4bed40](https://github.com/debuglebowski/SlayZone/commit/a4bed40))
- **task:** Processes panel UI polish + global/task scope toggle ([5945524](https://github.com/debuglebowski/SlayZone/commit/5945524))
- **leaderboard:** Show best rank on leaderboard tab badge ([7c50a89](https://github.com/debuglebowski/SlayZone/commit/7c50a89))
- **browser:** Inline Chromium DevTools panel ([1648428](https://github.com/debuglebowski/SlayZone/commit/1648428))
- **browser:** Highlight DevTools button when panel is open ([f023138](https://github.com/debuglebowski/SlayZone/commit/f023138))
- **processes:** Persistent processes with improved UI ([b86d987](https://github.com/debuglebowski/SlayZone/commit/b86d987))
- **processes:** Add ⌘O shortcut for processes panel; panel focus glow ([989e84f](https://github.com/debuglebowski/SlayZone/commit/989e84f))
- **ui:** Focused panel glow + borders ([9bd89b8](https://github.com/debuglebowski/SlayZone/commit/9bd89b8))
- **convex:** ForgetMe, path aliases, CSP github.com, gitignore ([fe89e5a](https://github.com/debuglebowski/SlayZone/commit/fe89e5a))
- **terminal:** Implement codex detectError ([0341906](https://github.com/debuglebowski/SlayZone/commit/0341906))
- **worktrees:** Show keyboard shortcuts on git panel tabs ([82a80c7](https://github.com/debuglebowski/SlayZone/commit/82a80c7))
- **ui:** Hide panel glow when only one panel visible ([9221bb1](https://github.com/debuglebowski/SlayZone/commit/9221bb1))

### 🩹 Fixes

- **browser:** Harden inline DevTools stability ([eaf49b7](https://github.com/debuglebowski/SlayZone/commit/eaf49b7))
- **ci:** Pipe jwt/jwks via stdin to avoid multiline CLI parse error ([114c537](https://github.com/debuglebowski/SlayZone/commit/114c537))
- **browser:** Minimize DevTools resize handle ([ac65e81](https://github.com/debuglebowski/SlayZone/commit/ac65e81))
- **leaderboard:** Npx ccusage, skip zero-token days, dev-only rank query ([c2b83a0](https://github.com/debuglebowski/SlayZone/commit/c2b83a0))
- **browser:** Remove native DevTools window button ([6725cd0](https://github.com/debuglebowski/SlayZone/commit/6725cd0))
- **browser:** Use Bug icon for DevTools toggle button ([297cb4c](https://github.com/debuglebowski/SlayZone/commit/297cb4c))
- **browser:** Reorder toolbar buttons to Import, Responsive, Select, DevTools ([c8f0962](https://github.com/debuglebowski/SlayZone/commit/c8f0962))
- **browser:** Remove did-navigate verification from popup suppression ([56a9504](https://github.com/debuglebowski/SlayZone/commit/56a9504))
- **browser:** Remove pre-warm to eliminate startup popup ([0e6edcb](https://github.com/debuglebowski/SlayZone/commit/0e6edcb))
- **browser:** Restore pre-warm and fix suppressPopup cleanup timing ([552975a](https://github.com/debuglebowski/SlayZone/commit/552975a))
- **terminal:** Prevent garbage injection from escape sequence responses ([ab08bd1](https://github.com/debuglebowski/SlayZone/commit/ab08bd1))

### 💅 Refactors

- **browser:** Clean up inline DevTools main process code ([927b103](https://github.com/debuglebowski/SlayZone/commit/927b103))
- **browser:** Improve DevTools sustainability ([be32c16](https://github.com/debuglebowski/SlayZone/commit/be32c16))

### 🏡 Chore

- Restore previously staged non-telemetry changes ([88d8ce0](https://github.com/debuglebowski/SlayZone/commit/88d8ce0))
- **ci:** Deploy Convex to prod on release + bake VITE_CONVEX_URL ([6ae8fd6](https://github.com/debuglebowski/SlayZone/commit/6ae8fd6))
- **ci:** Set JWT_PRIVATE_KEY and JWKS in Convex prod on deploy ([4eb2061](https://github.com/debuglebowski/SlayZone/commit/4eb2061))
- **ci:** Remove jwt/jwks from release workflow (one-time setup, not per-deploy) ([d5beac3](https://github.com/debuglebowski/SlayZone/commit/d5beac3))

### ✅ Tests

- **browser:** Add devtools e2e tests ([b1b35af](https://github.com/debuglebowski/SlayZone/commit/b1b35af))

### ❤️ Contributors

- Debuglebowski




## v0.1.55...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.55...main)




## v0.1.54...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.54...main)

### 🩹 Fixes

- **lockfile:** Sync app importer deps ([f7ba93a](https://github.com/debuglebowski/SlayZone/commit/f7ba93a))

### ❤️ Contributors

- Debuglebowski




## v0.1.52...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.52...main)

### 🩹 Fixes

- **app:** Add missing radix collapsible dependency ([98a7abf](https://github.com/debuglebowski/SlayZone/commit/98a7abf))

### 📖 Documentation

- Improve get started macOS instructions ([840bcb7](https://github.com/debuglebowski/SlayZone/commit/840bcb7))

### ❤️ Contributors

- Debuglebowski




## v0.1.51...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.51...main)

### 🚀 Enhancements

- **web-panel:** Add copy URL button ([5651bc7](https://github.com/debuglebowski/SlayZone/commit/5651bc7))
- **terminal:** Crash recovery, PATH enrichment, doctor validation ([5baa678](https://github.com/debuglebowski/SlayZone/commit/5baa678))
- **terminal:** Cmd+W closes focused pane, focuses adjacent pane/group ([5a9ea80](https://github.com/debuglebowski/SlayZone/commit/5a9ea80))
- **webview:** Block external app protocol launches ([aa08810](https://github.com/debuglebowski/SlayZone/commit/aa08810))
- **terminal:** Cmd+W closes task tab when sub-panel has nothing to close ([1d8a1a6](https://github.com/debuglebowski/SlayZone/commit/1d8a1a6))
- Update keyboard shortcuts modal ([e591aaa](https://github.com/debuglebowski/SlayZone/commit/e591aaa))

### 🩹 Fixes

- **terminal:** Fish PATH, unsupported shell doctor feedback, remove shell setting ([79a8da3](https://github.com/debuglebowski/SlayZone/commit/79a8da3))
- **kanban:** Ring only on keyboard focus, not hover ([600ebb4](https://github.com/debuglebowski/SlayZone/commit/600ebb4))
- **webview:** Remove preload-based window.open patching, rely on protocol handler ([4543ef2](https://github.com/debuglebowski/SlayZone/commit/4543ef2))

### ❤️ Contributors

- Debuglebowski




## v0.1.50...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.50...main)

### 🩹 Fixes

- Push specific tag instead of all tags on release ([f2bc8db](https://github.com/debuglebowski/SlayZone/commit/f2bc8db))
- Surface update errors to UI, show download progress ([262706a](https://github.com/debuglebowski/SlayZone/commit/262706a))

### ❤️ Contributors

- Debuglebowski




## v0.1.49...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.49...main)

### 📖 Documentation

- Second test change ([19edc26](https://github.com/debuglebowski/SlayZone/commit/19edc26))

### ❤️ Contributors

- Debuglebowski




## v0.1.48...main

[compare changes](https://github.com/debuglebowski/SlayZone/compare/v0.1.48...main)

### 🩹 Fixes

- Release script guards + clean changelog generation ([626930e](https://github.com/debuglebowski/SlayZone/commit/626930e))

### 📖 Documentation

- Add trailing newline ([0038a3a](https://github.com/debuglebowski/SlayZone/commit/0038a3a))

### ❤️ Contributors

- Debuglebowski




## v0.1.47...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.47...main)

### 🚀 Enhancements

- **tasks:** Signal bar priority indicators on kanban cards ([f33bc8c](https://github.com/debuglebowski/omgslayzone/commit/f33bc8c))
- **ui:** Add scroll + thin scrollbar to keyboard shortcuts dialog ([4c64a90](https://github.com/debuglebowski/omgslayzone/commit/4c64a90))
- **task:** Replace in-progress modal with header button ([ce37d16](https://github.com/debuglebowski/omgslayzone/commit/ce37d16))
- **updater:** Show in-app toast when update downloaded ([4b25110](https://github.com/debuglebowski/omgslayzone/commit/4b25110))
- **file-editor:** Render image files in editor panel ([c9d7fcb](https://github.com/debuglebowski/omgslayzone/commit/c9d7fcb))
- **file-editor:** Drag-and-drop files/folders from Finder into editor ([7d9cdac](https://github.com/debuglebowski/omgslayzone/commit/7d9cdac))
- **terminal:** Split terminals into groups with drag-and-drop ([dd53716](https://github.com/debuglebowski/omgslayzone/commit/dd53716))
- **file-editor:** Drag-and-drop to move files/folders within tree ([e0a8279](https://github.com/debuglebowski/omgslayzone/commit/e0a8279))
- **browser:** Multi-device responsive preview + web panel emulation ([4e8068d](https://github.com/debuglebowski/omgslayzone/commit/4e8068d))

### 🩹 Fixes

- **task:** Align title padding and font with kanban header ([ce6fa15](https://github.com/debuglebowski/omgslayzone/commit/ce6fa15))
- **ui:** Add left padding in zen mode to match right/bottom ([08c3fc9](https://github.com/debuglebowski/omgslayzone/commit/08c3fc9))

### 📖 Documentation

- Add known bugs section and star history to README ([750003a](https://github.com/debuglebowski/omgslayzone/commit/750003a))
- Update known bugs list ([656dc14](https://github.com/debuglebowski/omgslayzone/commit/656dc14))
- Trim known bugs list ([59052ae](https://github.com/debuglebowski/omgslayzone/commit/59052ae))

### 🏡 Chore

- Add star history image to assets ([b66bf1e](https://github.com/debuglebowski/omgslayzone/commit/b66bf1e))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.46...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.46...main)

### 🩹 Fixes

- **file-editor:** Show gitignored files grayed out instead of hiding them ([62929e2](https://github.com/debuglebowski/omgslayzone/commit/62929e2))
- **ci:** Inject PostHog secrets into release build ([ed4dfc2](https://github.com/debuglebowski/omgslayzone/commit/ed4dfc2))

### 📖 Documentation

- **website:** Sync features with README, add status tracking ([a3b4a90](https://github.com/debuglebowski/omgslayzone/commit/a3b4a90))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.45...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.45...main)

### 🩹 Fixes

- **terminal:** Catch EBADF on PTY resize when fd is invalid ([9ee1d2f](https://github.com/debuglebowski/omgslayzone/commit/9ee1d2f))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.44...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.44...main)

### 🩹 Fixes

- Auto-updater restart — download before quitAndInstall, add dock progress ([9d0897f](https://github.com/debuglebowski/omgslayzone/commit/9d0897f))

### 💅 Refactors

- Remove checkAvailability + shell-path dependency ([56226fa](https://github.com/debuglebowski/omgslayzone/commit/56226fa))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.43...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.43...main)

### 🩹 Fixes

- CLI detection in prod — use full path + enrich PATH with common bin dirs ([b7440ab](https://github.com/debuglebowski/omgslayzone/commit/b7440ab))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.42...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.42...main)

### 🚀 Enhancements

- Add explode mode — grid view of all open task terminals ([7126a78](https://github.com/debuglebowski/omgslayzone/commit/7126a78))

### 🩹 Fixes

- Move shellPath() into checkAvailability to fix CLI detection without blocking startup ([77da6c5](https://github.com/debuglebowski/omgslayzone/commit/77da6c5))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.40...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.40...main)

### 🩹 Fixes

- Await shellPath() to fix CLI detection in production ([ca522d6](https://github.com/debuglebowski/omgslayzone/commit/ca522d6))
- Auto-updater CJS/ESM interop — use default import ([d5774c7](https://github.com/debuglebowski/omgslayzone/commit/d5774c7))

### 🏡 Chore

- Replace tsc with tsgo for typechecking (22s → 5s) ([fd98337](https://github.com/debuglebowski/omgslayzone/commit/fd98337))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.39...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.39...main)

### 🩹 Fixes

- Change Monosketch shortcut from Cmd+K to Cmd+U ([159cf09](https://github.com/debuglebowski/omgslayzone/commit/159cf09))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.38...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.38...main)

### 🩹 Fixes

- Update Monosketch panel URL to app.monosketch.io ([5a37d14](https://github.com/debuglebowski/omgslayzone/commit/5a37d14))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.37...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.37...main)

### 🩹 Fixes

- **tasks:** Add missing react-hotkeys-hook dependency ([903bccf](https://github.com/debuglebowski/omgslayzone/commit/903bccf))

### ❤️ Contributors

- Debuglebowski <>

## ...main

## v0.1.35...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.35...main)

### 🚀 Enhancements

- Add "Check for Updates" to app menu ([bfa6670](https://github.com/debuglebowski/omgslayzone/commit/bfa6670))

### 🩹 Fixes

- Disable auto-download on startup ([50c9bf2](https://github.com/debuglebowski/omgslayzone/commit/50c9bf2))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.34...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.34...main)

### 🩹 Fixes

- Add favicon to website ([886b767](https://github.com/debuglebowski/omgslayzone/commit/886b767))
- Allow Cmd+R reload in production ([5404504](https://github.com/debuglebowski/omgslayzone/commit/5404504))
- Restore user PATH in production, simplify Claude CLI check ([d9f8443](https://github.com/debuglebowski/omgslayzone/commit/d9f8443))

### 📖 Documentation

- MacOS Gatekeeper note in README ([6040e4a](https://github.com/debuglebowski/omgslayzone/commit/6040e4a))

### ❤️ Contributors

- Debuglebowski <>

## v0.1.31...main

[compare changes](https://github.com/debuglebowski/omgslayzone/compare/v0.1.31...main)

### 🩹 Fixes

- GitHub links on website → SlayZone/SlayZone ([2799cfd](https://github.com/debuglebowski/omgslayzone/commit/2799cfd))

### ❤️ Contributors

- Debuglebowski <>
