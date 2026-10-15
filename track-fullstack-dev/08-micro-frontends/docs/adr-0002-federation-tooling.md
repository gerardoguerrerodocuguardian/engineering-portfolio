# ADR 0002 - Tooling: @module-federation/vite, runtime registration, Web Component remote

Status: accepted

- **Module Federation via `@module-federation/vite` + `@module-federation/runtime`.** Installed, built and ran cleanly with
  Vite 6 and React 18. The shell declares no remotes in config; `registerRemotes()` is called at runtime with URLs from
  `manifest.json`, which is what makes independent deployment real (the shell is not rebuilt to move a remote).
- **React pinned to 18.3 as a singleton.** Two React copies break hooks. The manifest records the range each remote was built
  against and the shell refuses a remote whose range the shell does not satisfy (clear fallback instead of a hooks crash).
- **Reports as a framework-agnostic Web Component (vanilla TS, Shadow DOM)** loaded as a plain ES module. It proves
  cross-technology integration through a tiny contract (tag, `tokenProvider` property, window event bus) and shares nothing at runtime.
- **Why not Angular Native Federation here:** it is a good fit when the remotes are Angular and need the Angular runtime shared
  as singletons. I did not include it because it needs the Angular CLI/esbuild builder and its own host setup, which would double the
  tooling in a small demo, and I did not verify it in this sandbox. An Angular remote could still be integrated today as a
  Web Component (Angular Elements) behind the same contract, at the cost of bundling its own Angular copy.
- **Cross-MFE communication:** DOM CustomEvents on `window`, typed in `shared-contracts`, with a last-value cache for remotes that
  load after the event. No shared store and no imports between apps.
- **Styling:** CSS variables from `shared-ui-tokens` (they cross the Shadow DOM boundary).
