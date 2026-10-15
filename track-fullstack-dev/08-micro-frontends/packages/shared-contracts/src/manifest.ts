/** Deployment manifest contract: what the shell reads at runtime to discover remotes. */
export type RemoteKind = 'module-federation' | 'web-component';

export interface RemoteEntry {
  /** Stable id, also the route segment. */
  id: string;
  title: string;
  kind: RemoteKind;
  /** URL of remoteEntry.js (module-federation) or of the ES module (web-component). */
  entry: string;
  version: string;
  /** module-federation: MF remote name + exposed module. */
  scope?: string;
  expose?: string;
  /** web-component: the custom element tag the module defines. */
  tag?: string;
  /** Shared deps this build was compiled against (semver ranges), used for version-skew checks. */
  requires: Record<string, string>;
}

export interface Manifest {
  schema: 1;
  generatedAt: string;
  remotes: RemoteEntry[];
}
