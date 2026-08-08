# Optional scanned anatomy meshes

The body explorer works with nothing in this folder — every structure is
generated procedurally from anatomical measurements. This folder is the slot for
replacing any of them with a scanned or sculpted mesh.

## How to add one

1. Drop a `.glb` (glTF binary) in this folder.
2. Add it to `manifest.json`, keyed by the structure `id` from
   `assets/js/lib/body-core.js`:

```json
{
  "source": "BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP",
  "structures": {
    "heart": { "file": "heart.glb", "scale": 1.0, "position": [1.5, 124, 3.5] },
    "liver": { "file": "liver.glb", "scale": 1.0 }
  }
}
```

Meshes are expected in centimetres in the anatomical frame used by
`body-core.js`: +x to the subject's left, +y superior, +z anterior, origin at
the pelvic floor. `scale` and `position` correct for assets authored elsewhere.

## Licensing — read before adding anything

Anatomical geometry is somebody's work, and most of it is licensed. Before
committing a mesh, confirm you have the right to redistribute it under this
repository's terms.

| Source | Licence | Notes |
|---|---|---|
| **BodyParts3D** (RIKEN / DBCLS) | CC BY-SA 2.1 JP | ~3,000 labelled meshes, FMA-linked. Share-alike. |
| **Z-Anatomy** | CC BY-SA 4.0 | Full-body atlas derived from BodyParts3D. Share-alike. |
| **OpenAnatomy** (SPL / 3D Slicer) | CC BY / CC BY-SA | Segmented from real imaging. Check each atlas. |
| **Visible Human** (US NLM) | Licence required | Free for research; registration needed. |
| Commercial atlases (Zygote, BioDigital) | Proprietary | Redistribution generally prohibited. |
| Marketplace models (Sketchfab, TurboSquid…) | Varies per item | Check the individual item; many forbid redistribution. |

Two traps worth naming:

- **Share-alike is viral.** CC BY-SA geometry obliges you to license derived
  assets — and potentially the work they are embedded in — under compatible
  terms. Decide that deliberately, not by accident.
- **A model with no stated licence is not free to use.** Absent an explicit
  grant, copyright is reserved by default. "It was on GitHub" is not a licence,
  and re-exporting a mesh (which strips author metadata) does not create one.

Attribute every source you use here and in the app's credits.
