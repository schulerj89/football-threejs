import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import bpy
from mathutils import Vector


TARGET_HEIGHT_METERS = 1.85
BODY_NAME = "player_body_skinned"
ARMATURE_NAME = "player_armature"
RUNTIME_GLB_NAME = "player-base-rigged.glb"
MANIFEST_NAME = "player-asset-manifest.json"
REQUIRED_SOCKETS = {
    "socket_helmet": ("head", (0.0, 0.04, 0.0)),
    "socket_hair": ("head", (0.0, 0.08, 0.0)),
    "socket_head_accessory": ("head", (0.0, 0.10, 0.0)),
    "socket_shoulder_pads": ("chest", (0.0, 0.0, 0.0)),
    "socket_left_hand": ("hand_l", (0.0, 0.0, 0.0)),
    "socket_right_hand": ("hand_r", (0.0, 0.0, 0.0)),
    "socket_left_foot": ("foot_l", (0.0, 0.0, 0.0)),
    "socket_right_foot": ("foot_r", (0.0, 0.0, 0.0)),
    "socket_ball_carry": ("hand_r", (0.0, 0.03, 0.07)),
    "socket_ball_throw": ("hand_r", (0.0, 0.02, 0.12)),
}
REGION_MATERIALS = {
    "skin": ("mat_player_skin", (0.72, 0.49, 0.33, 1.0)),
    "jersey": ("mat_player_jersey", (0.36, 0.38, 0.39, 1.0)),
    "pants_socks": ("mat_player_pants_socks", (0.08, 0.09, 0.10, 1.0)),
    "shoes": ("mat_player_shoes", (0.42, 0.43, 0.44, 1.0)),
}
CANONICAL_BONES = {
    "hips": "hips",
    "spine": "spine_01",
    "spine01": "spine_02",
    "spine02": "chest",
    "neck": "neck",
    "head": "head",
    "leftshoulder": "clavicle_l",
    "leftarm": "upper_arm_l",
    "leftforearm": "lower_arm_l",
    "lefthand": "hand_l",
    "rightshoulder": "clavicle_r",
    "rightarm": "upper_arm_r",
    "rightforearm": "lower_arm_r",
    "righthand": "hand_r",
    "leftupleg": "upper_leg_l",
    "leftleg": "lower_leg_l",
    "leftfoot": "foot_l",
    "lefttoebase": "toe_l",
    "rightupleg": "upper_leg_r",
    "rightleg": "lower_leg_r",
    "rightfoot": "foot_r",
    "righttoebase": "toe_r",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Prepare a runtime Football JS modular player GLB.")
    parser.add_argument("--input", required=True, help="Validated Meshy rigged GLB.")
    parser.add_argument("--output-dir", required=True, help="Runtime public/models/player directory.")
    parser.add_argument("--metadata-dir", required=True, help="Metadata output directory.")
    parser.add_argument("--style", choices=["smooth", "ps1Flat"], default="ps1Flat")
    args, _ = parser.parse_known_args()
    return args


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one armature, found {len(armatures)}")
    if not meshes:
        raise RuntimeError("Expected at least one mesh")
    return armatures[0], meshes


def find_primary_body_mesh(meshes, armature):
    skinned = [
        obj for obj in meshes
        if any(mod.type == "ARMATURE" and mod.object == armature for mod in obj.modifiers)
    ]
    candidates = skinned or meshes
    return max(candidates, key=lambda obj: triangle_count(obj))


def remove_animations():
    for obj in bpy.context.scene.objects:
        obj.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def normalize_scene(armature, meshes):
    min_v, max_v = combined_bounds(meshes)
    height = max(max_v.y - min_v.y, 0.0001)
    scale = TARGET_HEIGHT_METERS / height
    center_x = (min_v.x + max_v.x) * 0.5
    center_z = (min_v.z + max_v.z) * 0.5
    for obj in [armature, *meshes]:
        obj.location.x -= center_x
        obj.location.z -= center_z
        obj.location.y -= min_v.y
        obj.scale *= scale
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [armature, *meshes]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def canonicalize_bones(armature, meshes):
    rename_map = {}
    for bone in armature.data.bones:
        canonical = CANONICAL_BONES.get(normalize_name(bone.name))
        if canonical:
            rename_map[bone.name] = canonical
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    used_names = {bone.name for bone in armature.data.edit_bones}
    for old_name, new_name in rename_map.items():
        bone = armature.data.edit_bones.get(old_name)
        if not bone or (new_name in used_names and new_name != old_name):
            continue
        bone.name = new_name
        used_names.add(new_name)
    bpy.ops.object.mode_set(mode="OBJECT")
    for mesh in meshes:
        for old_name, new_name in rename_map.items():
            group = mesh.vertex_groups.get(old_name)
            if group:
                group.name = new_name
    return rename_map


def normalize_name(name):
    return "".join(character.lower() for character in name if character.isalnum())


def create_region_materials(mesh):
    mesh.data.materials.clear()
    material_indices = {}
    for region, (name, color) in REGION_MATERIALS.items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Roughness"].default_value = 0.72
            bsdf.inputs["Metallic"].default_value = 0.0
        mesh.data.materials.append(material)
        material_indices[region] = len(mesh.data.materials) - 1
    return material_indices


def assign_material_regions(mesh):
    material_indices = create_region_materials(mesh)
    report = {region: 0 for region in REGION_MATERIALS}
    for polygon in mesh.data.polygons:
        region = classify_polygon_region(mesh, polygon)
        polygon.material_index = material_indices[region]
        report[region] += 1
    return report


def classify_polygon_region(mesh, polygon):
    vertex_names = dominant_vertex_group_names(mesh, polygon)
    average_y = sum(mesh.data.vertices[index].co.y for index in polygon.vertices) / max(len(polygon.vertices), 1)
    joined = " ".join(vertex_names).lower()
    if average_y < 0.18 or "foot" in joined or "toe" in joined:
        return "shoes"
    if average_y > 1.42 or any(token in joined for token in ["head", "neck", "hand"]):
        return "skin"
    if average_y > 0.82 or any(token in joined for token in ["spine", "chest", "shoulder", "arm", "forearm"]):
        return "jersey"
    return "pants_socks"


def dominant_vertex_group_names(mesh, polygon):
    weights = {}
    for vertex_index in polygon.vertices:
        vertex = mesh.data.vertices[vertex_index]
        for group_weight in vertex.groups:
            group = mesh.vertex_groups[group_weight.group]
            weights[group.name] = weights.get(group.name, 0.0) + group_weight.weight
    return [
        name for name, _ in sorted(weights.items(), key=lambda item: item[1], reverse=True)[:4]
    ]


def create_sockets(armature):
    sockets = []
    bone_names = {bone.name for bone in armature.data.bones}
    for socket_name, (preferred_bone, offset) in REQUIRED_SOCKETS.items():
        bone_name = preferred_bone if preferred_bone in bone_names else fallback_bone(preferred_bone, bone_names)
        if not bone_name:
            raise RuntimeError(f"Cannot create {socket_name}; no suitable bone for {preferred_bone}")
        empty = bpy.data.objects.new(socket_name, None)
        empty.empty_display_type = "PLAIN_AXES"
        empty.empty_display_size = 0.08
        bpy.context.collection.objects.link(empty)
        empty.parent = armature
        empty.parent_type = "BONE"
        empty.parent_bone = bone_name
        empty.location = offset
        empty["football_js_socket"] = True
        empty["football_js_socket_bone"] = bone_name
        sockets.append(empty)
    return sockets


def fallback_bone(preferred_bone, bone_names):
    fallback_order = {
        "head": ["Head", "head", "neck"],
        "chest": ["chest", "Spine02", "spine_02", "spine_01", "hips"],
        "hand_l": ["hand_l", "LeftHand", "lower_arm_l"],
        "hand_r": ["hand_r", "RightHand", "lower_arm_r"],
        "foot_l": ["foot_l", "LeftFoot", "toe_l"],
        "foot_r": ["foot_r", "RightFoot", "toe_r"],
    }
    for candidate in fallback_order.get(preferred_bone, []):
        if candidate in bone_names:
            return candidate
    return next(iter(bone_names), None)


def apply_style(mesh, style):
    for polygon in mesh.data.polygons:
        polygon.use_smooth = style == "smooth"


def export_runtime_glb(path, armature, body, sockets):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [armature, body, *sockets]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_extras=True,
        export_materials="EXPORT",
        export_skins=True,
    )


def write_manifest(path, runtime_glb, source_path, armature, body, sockets, classification_report, style):
    min_v, max_v = combined_bounds([body])
    manifest = {
        "assetId": "football-js-player-base",
        "assetVersion": 1,
        "sourcePath": str(source_path).replace("\\", "/"),
        "runtimePath": str(runtime_glb).replace("\\", "/"),
        "style": style,
        "triangleCount": triangle_count(body),
        "vertexCount": len(body.data.vertices),
        "boneNames": [bone.name for bone in armature.data.bones],
        "socketNames": [socket.name for socket in sockets],
        "materialRegionNames": [material.name for material in body.data.materials],
        "classificationReport": classification_report,
        "headModularity": {
            "status": "deferred",
            "reason": "Head vertices remain in the primary skinned mesh to preserve skin weights and avoid an unvalidated neck seam.",
        },
        "shoeModularity": {
            "status": "deferred",
            "reason": "Shoes remain in the primary skinned mesh to preserve foot weights and avoid holes above the ankle.",
        },
        "orientation": {"up": "+Y", "forward": "+Z"},
        "heightMeters": round(max_v.y - min_v.y, 6),
        "groundMinY": round(min_v.y, 8),
        "animationCount": len(bpy.data.actions),
        "contentHashes": {
            "runtimeGlb": sha256_file(runtime_glb),
        },
        "preparedAt": datetime.now(timezone.utc).isoformat(),
    }
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    return manifest


def triangle_count(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners))),
        Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners))),
    )


def combined_bounds(objects):
    mins = []
    maxes = []
    for obj in objects:
        min_v, max_v = world_bounds(obj)
        mins.append(min_v)
        maxes.append(max_v)
    return (
        Vector((min(v.x for v in mins), min(v.y for v in mins), min(v.z for v in mins))),
        Vector((max(v.x for v in maxes), max(v.y for v in maxes), max(v.z for v in maxes))),
    )


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    metadata_dir = Path(args.metadata_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    armature, meshes = import_glb(input_path)
    body = find_primary_body_mesh(meshes, armature)
    for mesh in meshes:
        if mesh != body:
            mesh.name = f"deferred_source_mesh_{mesh.name}"
            mesh.hide_set(True)
            mesh.hide_render = True
    remove_animations()
    normalize_scene(armature, [body])
    rename_map = canonicalize_bones(armature, [body])
    armature.name = ARMATURE_NAME
    armature.data.name = ARMATURE_NAME
    body.name = BODY_NAME
    body.data.name = BODY_NAME
    classification_report = assign_material_regions(body)
    apply_style(body, args.style)
    sockets = create_sockets(armature)

    runtime_glb = output_dir / RUNTIME_GLB_NAME
    manifest_path = output_dir / MANIFEST_NAME
    export_runtime_glb(runtime_glb, armature, body, sockets)
    manifest = write_manifest(
        manifest_path,
        runtime_glb,
        input_path,
        armature,
        body,
        sockets,
        classification_report,
        args.style,
    )
    (metadata_dir / "player-preparation-report.json").write_text(
        json.dumps(
            {
                "manifest": manifest,
                "renamedBones": rename_map,
                "sourceMeshCount": len(meshes),
            },
            indent=2,
        ) + "\n",
        encoding="utf8",
    )


if __name__ == "__main__":
    main()
