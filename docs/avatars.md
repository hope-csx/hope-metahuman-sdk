# Avatar models

This page is about the Standard 3D tier, the only one that renders on the
client. A Metahuman on either premium tier arrives as lip-synced video from the
service, has no GLB, and needs nothing here — see
[premium-avatars.md](./premium-avatars.md).

No 3D models are distributed in this repository. They are separately licensed
assets, often with terms that forbid redistribution, and shipping them from a
public MIT repository would misrepresent what you are allowed to do with them.

You have two options.

## Option 1 — bring your own model

Any GLB with ARKit-compatible blendshapes will work. The renderer looks for
morph targets by name and drives them from the Audio2Face-3D output; anything it
cannot find is skipped, so a partial rig degrades rather than fails.

### Requirements

| Requirement | Detail                                                             |
| ----------- | ------------------------------------------------------------------ |
| Format      | glTF 2.0 binary (`.glb`)                                           |
| Blendshapes | ARKit's 52 named shapes, as morph targets on the face mesh         |
| Naming      | camelCase (`jawOpen`) or snake_case (`jaw_open`); both are matched |
| Skeleton    | Optional. Needed only for head and eye rotation                    |
| Textures    | Embedded in the GLB, or same-origin                                |
| Budget      | Under 30 MB and 150k triangles for comfortable mobile performance  |

The blendshapes that matter most for speech are the jaw and mouth group:
`jawOpen`, `jawForward`, `jawLeft`, `jawRight`, `mouthClose`, `mouthFunnel`,
`mouthPucker`, `mouthSmileLeft`, `mouthSmileRight`, `mouthFrownLeft`,
`mouthFrownRight`, and the `mouthPress`/`mouthStretch`/`mouthRoll` pairs. Eye
and brow shapes drive the idle animation — blink, saccade, and gaze — and their
absence is noticeable but not fatal.

### Where to get one

- **Character Creator, MetaHuman, or Reallusion** exports with ARKit blendshape
  profiles selected.
- **Ready Player Me** avatars include ARKit morph targets by default.
- **Blender** with an ARKit shape-key naming addon, if you are authoring from
  scratch.

Validate a model before wiring it up by loading it in the
[glTF viewer](https://gltf-viewer.donmccurdy.com) and confirming the morph
target names.

### Serving it

Host the GLB anywhere the page can reach, then point the element at it:

```html
<hope-metahuman model-url="/models/your-avatar.glb"></hope-metahuman>
```

Same-origin is simplest. Cross-origin needs CORS on the model's host, and the
origin has to be in your `connect-src` Content-Security-Policy directive.

## Option 2 — use a platform-hosted model

Deployments with an avatar entitlement can serve models through the HOPE
Metahuman Service itself, which handles the licensing, the CDN, and keeping the
rig in step with the Audio2Face-3D configuration:

```html
<hope-metahuman
  base-url="https://api.your-deployment.example"
  model-url="https://api.your-deployment.example/avatars/{avatarId}/model.glb"
></hope-metahuman>
```

The model request carries the same machine token as the rest of the session, so
an unentitled caller gets a 403 rather than the file. Ask your account contact
which avatar IDs your organisation is licensed for.

## Troubleshooting

**The avatar loads but the face never moves.** The morph target names do not
match. Open the browser console: the renderer logs the names it found and the
ARKit shapes it could not map.

**The mouth moves but nothing else does.** Expected with a jaw-only rig. Eye and
brow shapes are needed for blink and gaze.

**The model renders black.** Textures failed to load — usually a cross-origin
GLB with external texture references. Re-export with textures embedded.

**Performance is poor on mobile.** Reduce triangle count and texture resolution.
The renderer already pauses when the canvas is off-screen or the tab is in the
background, so the remaining cost is per-frame geometry and shading.
