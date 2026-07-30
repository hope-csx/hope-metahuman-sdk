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
| `framing`          | `'head' \| 'bust' \| 'full'`   | `'head'` | How much of the model fills the view            |
| `camera`           | `AvatarCameraOptions`          | —        | Override the automatic framing                  |
| `lockRootRotation` | `boolean`                      | `true`   | Keep the avatar facing the camera               |
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

## Orientation and camera

The avatar faces the viewer by default, and in most cases there is nothing to
configure.

That default takes a small amount of work, because the two halves of a GLB
disagree. The rest pose faces down +Z, straight at the camera, but the idle body
animation exporters bake in usually does not: the Avaturn idle clip that ships
with these avatars yaws the whole skeleton about 32°, so an avatar that looked
correct while loading swings away the moment the clip starts. The renderer drops
that one track — the root bone's rotation — and keeps everything else, so the
body still shifts its weight and moves its arms while the avatar keeps looking
at the viewer.

Set `lockRootRotation: false` when a clip is _supposed_ to turn the avatar, or
when you would rather aim the camera than change the animation.

### Overriding the camera

By default the camera is placed automatically: `framing` decides how much of the
model fills the view, and the renderer measures the model to work out where to
stand. Pass `camera` to take over any part of that.

```ts
const avatar = new AvatarRenderer({
  canvas,
  modelUrl: '/models/your-avatar.glb',
  camera: {
    fov: 20,
    position: [0, 1.62, 0.75],
    target: [0, 1.6, 0],
  },
});
```

| Field      | Type                       | Default | Purpose                            |
| ---------- | -------------------------- | ------- | ---------------------------------- |
| `fov`      | `number`                   | `28`    | Vertical field of view, in degrees |
| `near`     | `number`                   | `0.05`  | Near clip plane                    |
| `far`      | `number`                   | `100`   | Far clip plane                     |
| `position` | `[number, number, number]` | —       | Where the camera stands            |
| `target`   | `[number, number, number]` | —       | What the camera looks at           |

Fields are independent, so you can widen the lens and leave the placement alone.
Supplying `position` replaces the computed position, which means `framing` no
longer affects where the camera stands. Supplying only `target` keeps the
automatic placement but measures the distance back from your look-at point —
useful for nudging the shot up or down without recomputing the geometry.

Coordinates are in the model's own world space. Avatars authored at human scale
in metres with the feet at the origin — the usual convention, and what Avaturn,
Ready Player Me, and Character Creator produce — put eye level at roughly
`y = 1.6`, so `[0, 1.6, 0.8]` is arm's length in front of an adult's face.

A lower `fov` is a longer lens: it flattens facial features and is generally
kinder to a portrait. Widening much past the default starts to distort the nose.

If your model was authored facing away from +Z, put the camera behind it rather
than rotating the model, which would take its lighting and animation with it:

```ts
camera: { position: [0, 1.6, -0.8], target: [0, 1.6, 0] };
```

The camera is also reachable after construction as `avatar.camera`, for an
application that wants to animate it.

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

`AvatarRenderer` handles this for you. The helpers are exported for applications
that drive their own `AnimationMixer`.

If your GLB ships with animation clips that also write morph targets, those
tracks fight the speech pose. `clipWithoutMorphTracks(clip)` strips them and
keeps the bone animation:

```ts
import { clipWithoutMorphTracks } from '@hope-metahuman/avatar-three';

mixer.clipAction(clipWithoutMorphTracks(gltf.animations[0])).play();
```

Pass a root bone name as the second argument to also drop the clip's root
rotation, which is what keeps the avatar facing the camera. `findRootBoneName`
locates it:

```ts
import { clipWithoutMorphTracks, findRootBoneName } from '@hope-metahuman/avatar-three';

const rootBone = findRootBoneName(gltf.scene);
mixer.clipAction(clipWithoutMorphTracks(gltf.animations[0], rootBone)).play();
```

Only the root bone's `.quaternion` and `.rotation` tracks are removed. Root
position and scale, and every child bone, are left alone, so the body still
animates.

## Licence

This documentation is [MIT](../LICENSE) licensed. The package it describes is
proprietary and commercially licensed — see [../NOTICE.md](../NOTICE.md).
