"""Create the distant-gameplay LOD for the existing Football JS helmet.

Run this deterministic script inside Blender through the official Blender Lab
MCP. The source helmet remains untouched and is still used for close shots; this
LOD keeps two semantic source regions which the runtime merges into one
vertex-colored draw call while preserving team-specific recoloring.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


SCRIPT_PATH = Path(globals().get("__file__", "tools/blender/create_helmet_lod.py"))
REPO_ROOT = SCRIPT_PATH.resolve().parents[2] if SCRIPT_PATH.is_absolute() else Path.cwd()
HELMET_DIR = REPO_ROOT / "public" / "models" / "helmet"
SOURCE_PATH = HELMET_DIR / "football-helmet-kit.glb"
LOD_PATH = HELMET_DIR / "football-helmet-kit-lod.glb"
MANIFEST_PATH = HELMET_DIR / "helmet-lod-manifest.json"
BLEND_PATH = REPO_ROOT / "art-source" / "blender" / "voxel-player" / "football-helmet-kit-lod.blend"

def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)


def create_shell(material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0.0, 0.0, 0.08))
    shell = bpy.context.object
    shell.name = "helmet_shell"
    shell.data.name = "helmet_shell_lod_mesh"
    shell.scale = (0.88, 0.78, 0.92)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    mesh = bmesh.new()
    mesh.from_mesh(shell.data)
    front_opening = [
        face
        for face in mesh.faces
        if (face.calc_center_median().y < -0.28 and face.calc_center_median().z < 0.42)
        or face.calc_center_median().z < -0.58
    ]
    bmesh.ops.delete(mesh, geom=front_opening, context="FACES")
    mesh.to_mesh(shell.data)
    mesh.free()
    shell.data.materials.append(material)
    for polygon in shell.data.polygons:
        polygon.use_smooth = False
    return shell


def create_bar(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    thickness: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(start_vector + end_vector) * 0.5)
    bar = bpy.context.object
    bar.name = name
    bar.rotation_euler = direction.to_track_quat("X", "Z").to_euler()
    bar.scale = (direction.length, thickness, thickness)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bar.data.materials.append(material)
    return bar


def create_faceguard(material: bpy.types.Material) -> bpy.types.Object:
    bar_specs = [
        ("faceguard_brow", (-0.68, -0.86, 0.14), (0.68, -0.86, 0.14), 0.065),
        ("faceguard_mouth", (-0.60, -0.93, -0.12), (0.60, -0.93, -0.12), 0.065),
        ("faceguard_left_vertical", (-0.46, -0.88, 0.16), (-0.38, -0.91, -0.39), 0.060),
        ("faceguard_right_vertical", (0.46, -0.88, 0.16), (0.38, -0.91, -0.39), 0.060),
        ("faceguard_left_side", (-0.70, -0.50, -0.10), (-0.57, -0.90, -0.13), 0.065),
        ("faceguard_right_side", (0.70, -0.50, -0.10), (0.57, -0.90, -0.13), 0.065),
        ("faceguard_left_cheek", (-0.70, -0.50, -0.10), (-0.58, -0.62, -0.47), 0.065),
        ("faceguard_right_cheek", (0.70, -0.50, -0.10), (0.58, -0.62, -0.47), 0.065),
    ]
    bars = [create_bar(name, start, end, thickness, material) for name, start, end, thickness in bar_specs]
    bpy.ops.object.select_all(action="DESELECT")
    for bar in bars:
        bar.select_set(True)
    bpy.context.view_layer.objects.active = bars[0]
    bpy.ops.object.join()
    faceguard = bpy.context.object
    faceguard.name = "faceguard_standard"
    faceguard.data.name = "faceguard_standard_lod_mesh"
    return faceguard


def calculate_bounds(meshes: list[bpy.types.Object]) -> dict[str, dict[str, float]]:
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    size = maximum - minimum
    return {
        "min": {"x": minimum.x, "y": minimum.y, "z": minimum.z},
        "max": {"x": maximum.x, "y": maximum.y, "z": maximum.z},
        "size": {"x": size.x, "y": size.y, "z": size.z},
    }


def build() -> dict[str, object]:
    HELMET_DIR.mkdir(parents=True, exist_ok=True)
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_PATH))

    source_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    source_materials = {
        material.name: material
        for obj in source_meshes
        for material in obj.data.materials
    }
    shell_material = source_materials.get("mat_helmet_shell")
    faceguard_material = source_materials.get("mat_faceguard")
    if shell_material is None or faceguard_material is None:
        raise RuntimeError(f"Existing helmet materials were not found: {sorted(source_materials)}")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)

    meshes = [create_shell(shell_material), create_faceguard(faceguard_material)]
    for obj in meshes:
        obj["lod_role"] = "distant-gameplay"
        obj["source_asset"] = "football-helmet-kit.glb"

    meshes.sort(key=lambda obj: obj.name)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(LOD_PATH),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )

    counts = {obj.name: triangle_count(obj) for obj in meshes}
    manifest = {
        "assetId": "football-helmet-kit-lod",
        "assetVersion": 1,
        "bounds": calculate_bounds(meshes),
        "contentHashes": {
            "football-helmet-kit.glb": hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest(),
            "football-helmet-kit-lod.glb": hashlib.sha256(LOD_PATH.read_bytes()).hexdigest(),
        },
        "createdWith": {
            "blender": bpy.app.version_string,
            "mcp": "Blender Lab MCP v1.0.0",
            "mcpSourceCommit": "03004fd0216bfe5e0a3d9ac9b47d5efadc3d78c4",
        },
        "lodDistanceMeters": 8,
        "materialNames": sorted({material.name for obj in meshes for material in obj.data.materials}),
        "meshNames": sorted(counts),
        "runtimeDrawCallsPerInstance": 1,
        "runtimeMergeStrategy": "single-mesh-vertex-colors",
        "sourceAssetId": "football-helmet-kit",
        "triangleCount": sum(counts.values()),
        "trianglesByMesh": counts,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    return {
        "blendPath": str(BLEND_PATH),
        "glbPath": str(LOD_PATH),
        "manifestPath": str(MANIFEST_PATH),
        "meshCount": len(meshes),
        "triangleCount": manifest["triangleCount"],
        "trianglesByMesh": counts,
    }


RESULT = build()
result = RESULT
