/**
 * Preconfiguration for the static example.
 *
 * Edit these values to point the page at your deployment and skip retyping
 * them on every visit. Anything you save in the settings panel overrides what
 * is here, and the panel opens automatically while `baseUrl` and `voiceId` are
 * still empty.
 *
 * Never put an API key secret in this file. It is served to the browser
 * verbatim, so anything in it is public to every visitor. The only credential
 * that belongs in a browser is a machine token, which expires in ten minutes —
 * and even that is better fetched from `tokenEndpoint` than embedded here.
 */
export default {
  /** HTTPS origin of your HOPE Metahuman Service deployment. */
  baseUrl: 'http://localhost:3001',

  /**
   * A URL on your own backend that authenticates the visitor and returns
   * `{ "token": "…", "expiresIn": 600 }`. This is the recommended credential
   * path for anything that is not a local experiment.
   *
   * Example: '/api/hope/stream-token'
   */
  tokenEndpoint: '/api/hope/stream-token',

  /** `standard` loads a GLB; `premium` requests live video from the service. */
  avatarKind: 'standard',

  /** Tenant Metahuman ID. Required for Premium; recommended for Standard. */
  metahumanId: '',

  /**
   * GLB avatar with ARKit-compatible morph targets.
   *
   * No models are distributed with this repository — they are separately
   * licensed assets. Bring your own ARKit-rigged GLB, or point this at a
   * platform-hosted model if your deployment is entitled to one. See
   * docs/avatars.md.
   *
   * Leave it empty to run chat-only, with no face.
   */
  modelUrl: 'http://localhost:3001/public/models/avatar.glb',

  /** Still and muted preview used while Premium live rendering starts or falls back. */
  posterUrl: '',
  previewVideoUrl: '',

  /** Voice from your tenant's catalogue. */
  voiceId: 'f014dce5-df0e-4cfa-98e1-bd4bb73bb0b1',
  voiceModel: 'sonic-3',

  /** The persona's own name, which the agent may use when introducing itself. */
  metahumanName: 'Nelson',

  /** BCP-47 tag for transcription and replies. */
  language: 'en-US',
};
