import argparse
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


EXPECTED_MATERIALS = {
    "mat_player_skin",
    "mat_player_jersey",
    "mat_player_pants_socks",
    "mat_player_shoes",
}
REQUIRED_SOCKETS = {
    "socket_helmet",
    "socket_hair",
    "socket_head_accessory",
    "socket_shoulder_pads",
    "socket_left_hand",
    "socket_right_hand",
    "socket_left_foot",
    "socket_right_foot",
    "socket_ball_carry",
    "socket_ball_throw",
}
TARGET_HEIGHT_METERS = 1.85


def parse_args():
    parser = argparse.ArgumentParser(description="Validate a prepared Football JS modular player kit.")
    parser.add_argument("--kit", required=True, help="Prepared runtime player GLB.")
    parser.add_argument("--manifest", required=True, help="Prepared player manifest JSON.")
    parser.add_argument("--report", required=True, help="Validation report output path.")
    args, _ = parser.parse_known_args()
    return args


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    empties = [obj for obj in bpy.context.scene.objects if obj.type == "EMPTY"]
    return armatures, meshes, empties


def validate_transforms(objects):
    failures = []
    for obj in objects:
        values = [
            *obj.location,
            *obj.rotation_euler,
            *obj.scale,
            *[component for row in obj.matrix_world for component in row],
        ]
        if any(math.isnan(float(value)) or math.isinf(float(value)) for value in values):
            failures.append(f"{obj.name} contains a NaN or infinite transform")
    return failures


def find_primary_skinned_mesh(meshes, armature):
    skinned = [
        mesh for mesh in meshes
        if any(mod.type == "ARMATURE" and mod.object == armature for mod in mesh.modifiers)
    ]
    if not skinned:
        return None
    return max(skinned, key=lambda mesh: triangle_count(mesh))


def validate_skin_indices(mesh, armature):
    failures = []
    bone_names = {bone.name for bone in armature.data.bones}
    groups = {group.name for group in mesh.vertex_groups}
    missing_groups = sorted(group for group in groups if group not in bone_names)
    if missing_groups:
        failures.append(f"Vertex groups without matching bones: {', '.join(missing_groups[:12])}")

    weighted_vertices = 0
    for vertex in mesh.data.vertices:
        if vertex.groups:
            weighted_vertices += 1
    if weighted_vertices == 0:
        failures.append("Primary body mesh has no weighted vertices")
    return failures


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners))),
        Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners))),
    )


def triangle_count(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def load_manifest(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf8"))


def main():
    args = parse_args()
    kit_path = Path(args.kit)
    manifest_path = Path(args.manifest)
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    failures = []
    metrics = {}
    manifest = load_manifest(manifest_path)
    if not manifest:
        failures.append(f"Missing manifest: {manifest_path}")

    if not kit_path.exists():
        failures.append(f"Missing prepared GLB: {kit_path}")
        write_report(report_path, failures, metrics, manifest)
        raise SystemExit(1)

    clear_scene()
    armatures, meshes, empties = import_glb(kit_path)
    all_objects = [*armatures, *meshes, *empties]
    failures.extend(validate_transforms(all_objects))

    if len(armatures) != 1:
        failures.append(f"Expected one armature, found {len(armatures)}")
        armature = None
    else:
        armature = armatures[0]

    if armature:
        body = find_primary_skinned_mesh(meshes, armature)
    else:
        body = None

    if not body:
        failures.append("Expected one primary skinned body mesh with an Armature modifier")
    elif len(body.data.vertices) == 0 or len(body.data.polygons) == 0:
        failures.append("Primary body mesh is empty")

    if len(bpy.data.actions) != 0:
        failures.append(f"Expected zero animation clips, found {len(bpy.data.actions)}")

    socket_names = {empty.name for empty in empties}
    missing_sockets = sorted(REQUIRED_SOCKETS - socket_names)
    if missing_sockets:
        failures.append(f"Missing required sockets: {', '.join(missing_sockets)}")

    if body:
        material_names = {material.name for material in body.data.materials}
        if len(material_names) > 4:
            failures.append(f"Expected no more than four body material regions, found {len(material_names)}")
        missing_materials = sorted(EXPECTED_MATERIALS - material_names)
        if missing_materials:
            failures.append(f"Missing material regions: {', '.join(missing_materials)}")

        min_v, max_v = world_bounds(body)
        height = max_v.y - min_v.y
        if abs(min_v.y) > 0.03:
            failures.append(f"Feet are not grounded: minY={min_v.y:.5f}")
        if not (TARGET_HEIGHT_METERS - 0.05 <= height <= TARGET_HEIGHT_METERS + 0.05):
            failures.append(f"Height {height:.5f}m is outside tolerance around {TARGET_HEIGHT_METERS}m")
        if armature:
            failures.extend(validate_skin_indices(body, armature))
        metrics.update(
            {
                "triangleCount": triangle_count(body),
                "vertexCount": len(body.data.vertices),
                "materialNames": sorted(material_names),
                "heightMeters": round(height, 6),
                "groundMinY": round(min_v.y, 8),
            }
        )

    if manifest:
        orientation = manifest.get("orientation")
        if orientation != {"up": "+Y", "forward": "+Z"}:
            failures.append(f"Manifest orientation must be +Y up and +Z forward, found {orientation}")
        if manifest.get("animationCount") != 0:
            failures.append(f"Manifest reports nonzero animation count: {manifest.get('animationCount')}")
        manifest_sockets = set(manifest.get("socketNames", []))
        missing_manifest_sockets = sorted(REQUIRED_SOCKETS - manifest_sockets)
        if missing_manifest_sockets:
            failures.append(f"Manifest missing socket names: {', '.join(missing_manifest_sockets)}")

    if armature:
        metrics["boneNames"] = [bone.name for bone in armature.data.bones]
        metrics["boneCount"] = len(armature.data.bones)
    metrics["socketNames"] = sorted(socket_names)
    metrics["meshNames"] = [mesh.name for mesh in meshes]
    metrics["animationCount"] = len(bpy.data.actions)

    write_report(report_path, failures, metrics, manifest)
    if failures:
        raise SystemExit(1)


def write_report(path, failures, metrics, manifest):
    report = {
        "passed": len(failures) == 0,
        "failures": failures,
        "metrics": metrics,
        "manifestAssetVersion": manifest.get("assetVersion") if manifest else None,
    }
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
