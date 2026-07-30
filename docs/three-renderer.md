# @hope-metahuman/avatar-three

Three.js rendering for HOPE Metahuman Service avatars. Loads a GLB, maps
Audio2Face-3D blendshape weights onto its morph targets, and layers autonomous
blink and gaze underneath the speech pose so the face is never quite still.

> This package is commercially licensed and is not distributed in this
> repository. See [self-hosting.md](./self-hosting.md) for how to obtain it.
> No avatar models are distributed here either — see [avatars.md](./avatars.md).

```bash
npm install @hope-metahuman/avatar-three three
```

`three` is a peer dependency, so your application controls the version and a
page never ends up with two copies of the engine.

---

## Usage

```ts
import { MetahumanSession } from '@hope-metahuman/sdk';
import { AvatarRenderer } from '@hope-metahuman/avatar-three';

const avatar = new AvatarRenderer({
  canvas: document.querySelector('canvas'),
  modelUrl: '/models/your-avatar.glb',
  poseSource: () => session.currentPose(),
  framing: 'head',
});

await avatar.load();
avatar.start();
```

`poseSource` is polled once per frame. Passing the session's `currentPose`
directly is the whole integration: the renderer asks for a pose, the session
returns the one matching the current audio position, and lip sync follows from
that. Without a pose source the avatar still blinks and glances around, which is
often what you want while waiting for a conversation to start.

For a renderer you drive yourself, skip `poseSource` and call
`applyPose(pose)` from your own loop.

## Options

| Option             | Type                           | Default  | Purpose                                         |
| ------------------ | ------------------------------ | -------- | ----------------------------------------------- |
| `canvas`           | `HTMLCanvasElement`            | —        | Target canvas; resizes with its container       |
| `modelUrl`         | `string`                       | —        | GLB with ARKit-compatible morph targets         |
| `poseSource`       | `() => BlendshapePose \| null` | —        | Polled once per frame                           |
| `framing`          | `'head' \| 'bust' \| 'full'`   | `'head'` | Camera position                                 |
| `background`       | `string \| null`               | `null`   | CSS colour, or `null` for transparent           |
| `idleAnimation`    | `boolean`                      | `true`   | Autonomous blink, saccade, and gaze             |
| `idleConfig`       | `Partial<IdleAnimationConfig>` | —        | Timing overrides                                |
| `blendshapeScales` | `Record<string, number>`       | —        | Per-shape multipliers                           |
| `maxPixelRatio`    | `number`                       | `2`      | Caps rendering on high-DPI displays             |
| `pauseWhenHidden`  | `boolean`                      | `true`   | Stop rendering while off screen or backgrounded |

`load()` resolves once the GLB is parsed and its morph targets are indexed;
`start()` begins the render loop; `stop()` pauses it; `dispose()` releases the
WebGL context, geometries, textures, and the resize observer.

Rendering pauses automatically when the canvas leaves the viewport or the tab is
hidden, so a metahuman scrolled off-screen costs nothing.

## Avatar requirements

The GLB needs morph targets named for the
[ARKit blendshape set](https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation).
Audio2Face-3D emits that vocabulary, and it is what every mainstream avatar
pipeline produces.

Naming is matched leniently. `jawOpen`, `JawOpen`, `jaw_open`, `Jaw_Open`, and
`head_jawOpen` all resolve to the same shape, so exports from Character Creator,
MetaHuman, Ready Player Me, and Blender generally work without renaming. Meshes
are searched recursively, so a head split across face, teeth, and tongue objects
animates as one.

Twenty-nine shapes carry speech; the remaining twenty-three are expression and
gaze. A rig missing some shapes still works — unmatched weights are ignored —
but the fewer mouth shapes it has, the less articulate the result.

### Where to get one

HOPE Metahuman Service deployments serve bundled avatars from `/public/models/`,
which needs no authentication. `GET /avatars` lists what your tenant has.

For your own: Character Creator 4 and MetaHuman both export ARKit-compatible
rigs, and Ready Player Me offers free GLB avatars with ARKit morph targets.

### Tuning the result

If the mouth looks over- or under-animated, scale individual shapes rather than
editing the rig:

```ts
new AvatarRenderer({
  ...options,
  blendshapeScales: { jawOpen: 0.8, mouthFunnel: 1.2 },
});
```

Speech blendshapes are generated for a generic face, so a rig with an unusually
wide jaw range can look slack at weight 1.0. Scaling is the cheapest fix.

## Idle animation

Blink, saccade, and gaze drift are pure functions over a state object, so they
are testable and reusable outside Three.js:

```ts
import { createIdleAnimationState, updateIdleAnimation } from '@hope-metahuman/avatar-three';

let state = createIdleAnimationState();
state = updateIdleAnimation(state, deltaSeconds, { blinkIntervalSeconds: [2, 5] });
```

Idle weights are added underneath the speech pose and clamped, so a blink during
speech reads as a blink rather than overwriting the mouth. Pass a `RandomSource`
to make the timing deterministic in tests.

## Animation clips

If your GLB ships with animation clips that also write morph targets, those
tracks fight the speech pose. `clipWithoutMorphTracks(clip)` strips them and
keeps the bone animation:

```ts
import { clipWithoutMorphTracks } from '@hope-metahuman/avatar-three';

mixer.clipAction(clipWithoutMorphTracks(gltf.animations[0])).play();
```

## Licence

This documentation is [MIT](../LICENSE) licensed. The package it describes is
proprietary and commercially licensed — see [../NOTICE.md](../NOTICE.md).
