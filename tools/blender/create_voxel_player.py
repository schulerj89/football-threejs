"""Build the Football JS rigid-weighted voxel player in Blender 5.1.

This script is intentionally deterministic and is executed inside Blender through
the official Blender Lab MCP. It writes the runtime GLB, its manifest, the .blend
source, and two Blender render artifacts.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_PATH = Path(globals().get("__file__", "tools/blender/create_voxel_player.py"))
REPO_ROOT = SCRIPT_PATH.resolve().parents[2] if SCRIPT_PATH.is_absolute() else Path.cwd()
RUNTIME_DIR = REPO_ROOT / "public" / "models" / "player"
SOURCE_DIR = REPO_ROOT / "art-source" / "blender" / "voxel-player"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "voxel-player-1.23.0"
GLB_PATH = RUNTIME_DIR / "player-base-rigged.glb"
MANIFEST_PATH = RUNTIME_DIR / "player-asset-manifest.json"
BLEND_PATH = SOURCE_DIR / "voxel-football-player.blend"
BLENDER_FRONT_PATH = ARTIFACT_DIR / "blender-front.png"
BLENDER_QUARTER_PATH = ARTIFACT_DIR / "blender-quarter.png"

MATERIAL_SPECS = {
    "mat_player_skin": (0.55, 0.28, 0.14, 1.0),
    "mat_player_jersey": (0.035, 0.23, 0.62, 1.0),
    "mat_player_pants_socks": (0.82, 0.86, 0.92, 1.0),
    "mat_player_shoes": (0.018, 0.025, 0.045, 1.0),
}

SOCKET_SPECS = {
    "socket_helmet": ("Head", (0.0, 0.0, 1.84)),
    "socket_hair": ("Head", (0.0, 0.085, 1.785)),
    "socket_head_accessory": ("Head", (0.0, 0.0, 1.84)),
    "socket_shoulder_pads": ("Spine02", (0.0, 0.0, 1.34)),
    "socket_hand_l": ("LeftHand", (-0.57, 0.0, 0.64)),
    "socket_hand_r": ("RightHand", (0.57, 0.0, 0.64)),
    "socket_foot_l": ("LeftFoot", (-0.19, -0.12, 0.08)),
    "socket_foot_r": ("RightFoot", (0.19, -0.12, 0.08)),
    "socket_ball_carry": ("Spine01", (-0.22, -0.24, 1.16)),
    "socket_ball_throw": ("RightHand", (0.57, -0.10, 0.68)),
}


def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def create_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = 0.78
        principled.inputs["Metallic"].default_value = 0.0
    return material


def add_weight_group(obj: bpy.types.Object, bone_name: str) -> None:
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")


def create_box_part(
    name: str,
    location: tuple[float, float, float],
    size: tuple[float, float, float],
    material: bpy.types.Material,
    bone_name: str,
    bevel: float = 0.018,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    # primitive_cube_add(size=1) creates a one-meter cube, so each scale
    # component is already the requested final edge length.
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new(name="voxel_chamfer", type="BEVEL")
        modifier.width = min(bevel, min(size) * 0.22)
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material)
    add_weight_group(obj, bone_name)
    return obj


def create_head_part(material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2,
        radius=0.155,
        location=(0.0, 0.012, 1.695),
    )
    obj = bpy.context.object
    obj.name = "voxel_head_round"
    obj.data.name = "voxel_head_round_mesh"
    obj.scale = (1.0, 0.96, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    add_weight_group(obj, "Head")
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def create_armature() -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("football_player_rig")
    armature = bpy.data.objects.new("football_player_rig", armature_data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    armature.data.display_type = "OCTAHEDRAL"
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(
        name: str,
        head: tuple[float, float, float],
        tail: tuple[float, float, float],
        parent: str | None = None,
        connected: bool = False,
        deform: bool = True,
    ) -> bpy.types.EditBone:
        edit_bone = armature.data.edit_bones.new(name)
        edit_bone.head = head
        edit_bone.tail = tail
        edit_bone.use_deform = deform
        if parent:
            edit_bone.parent = armature.data.edit_bones[parent]
            edit_bone.use_connect = connected
        return edit_bone

    bone("Hips", (0.0, 0.0, 0.96), (0.0, 0.0, 1.08))
    bone("Spine", (0.0, 0.0, 1.08), (0.0, 0.0, 1.20), "Hips", True)
    bone("Spine01", (0.0, 0.0, 1.20), (0.0, 0.0, 1.32), "Spine", True)
    bone("Spine02", (0.0, 0.0, 1.32), (0.0, 0.0, 1.45), "Spine01", True)
    bone("neck", (0.0, 0.0, 1.45), (0.0, 0.0, 1.56), "Spine02", True)
    bone("Head", (0.0, 0.0, 1.56), (0.0, 0.0, 1.82), "neck", True)
    bone("head_end", (0.0, 0.0, 1.82), (0.0, 0.0, 1.88), "Head", True, False)
    bone("headfront", (0.0, -0.02, 1.70), (0.0, -0.12, 1.70), "Head", False, False)

    bone("LeftShoulder", (-0.30, 0.0, 1.42), (-0.49, 0.0, 1.42), "Spine02", False, False)
    bone("LeftArm", (-0.57, 0.0, 1.36), (-0.57, 0.0, 0.98), "LeftShoulder")
    bone("LeftForeArm", (-0.57, 0.0, 0.98), (-0.57, 0.0, 0.69), "LeftArm", True)
    bone("LeftHand", (-0.57, 0.0, 0.69), (-0.57, 0.0, 0.57), "LeftForeArm", True)
    bone("RightShoulder", (0.30, 0.0, 1.42), (0.49, 0.0, 1.42), "Spine02", False, False)
    bone("RightArm", (0.57, 0.0, 1.36), (0.57, 0.0, 0.98), "RightShoulder")
    bone("RightForeArm", (0.57, 0.0, 0.98), (0.57, 0.0, 0.69), "RightArm", True)
    bone("RightHand", (0.57, 0.0, 0.69), (0.57, 0.0, 0.57), "RightForeArm", True)

    bone("LeftUpLeg", (-0.19, 0.0, 0.98), (-0.19, 0.0, 0.50), "Hips")
    bone("LeftLeg", (-0.19, 0.0, 0.50), (-0.19, 0.0, 0.14), "LeftUpLeg", True)
    bone("LeftFoot", (-0.19, 0.0, 0.14), (-0.19, -0.25, 0.12), "LeftLeg", True)
    bone("LeftToeBase", (-0.19, -0.25, 0.12), (-0.19, -0.36, 0.09), "LeftFoot", True)
    bone("RightUpLeg", (0.19, 0.0, 0.98), (0.19, 0.0, 0.50), "Hips")
    bone("RightLeg", (0.19, 0.0, 0.50), (0.19, 0.0, 0.14), "RightUpLeg", True)
    bone("RightFoot", (0.19, 0.0, 0.14), (0.19, -0.25, 0.12), "RightLeg", True)
    bone("RightToeBase", (0.19, -0.25, 0.12), (0.19, -0.36, 0.09), "RightFoot", True)

    for socket_name, (parent_name, head) in SOCKET_SPECS.items():
        tail = (head[0], head[1], head[2] + 0.03)
        bone(socket_name, head, tail, parent_name, False, False)

    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    return armature


def join_material_parts(
    material_name: str,
    parts: list[bpy.types.Object],
    armature: bpy.types.Object,
) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = material_name.removeprefix("mat_")
    joined.data.name = f"{joined.name}_mesh"
    joined["material_region"] = material_name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    modifier = joined.modifiers.new(name="football_player_armature", type="ARMATURE")
    modifier.object = armature
    joined.parent = armature
    joined.matrix_parent_inverse = armature.matrix_world.inverted()
    joined.select_set(False)
    return joined


def create_player_meshes(
    armature: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    parts_by_material: dict[str, list[bpy.types.Object]] = {
        name: [] for name in MATERIAL_SPECS
    }

    def box(
        region: str,
        name: str,
        location: tuple[float, float, float],
        size: tuple[float, float, float],
        bone_name: str,
        bevel: float = 0.018,
    ) -> None:
        parts_by_material[region].append(
            create_box_part(name, location, size, materials[region], bone_name, bevel)
        )

    jersey = "mat_player_jersey"
    pants = "mat_player_pants_socks"
    skin = "mat_player_skin"
    shoes = "mat_player_shoes"

    box(jersey, "voxel_torso", (0.0, 0.0, 1.245), (0.68, 0.38, 0.42), "Spine01", 0.035)
    box(jersey, "voxel_shoulder_pads", (0.0, 0.0, 1.405), (1.08, 0.44, 0.19), "Spine02", 0.035)
    box(jersey, "voxel_left_sleeve", (-0.57, 0.0, 1.17), (0.23, 0.32, 0.38), "LeftArm", 0.025)
    box(jersey, "voxel_right_sleeve", (0.57, 0.0, 1.17), (0.23, 0.32, 0.38), "RightArm", 0.025)

    box(pants, "voxel_hips", (0.0, 0.0, 1.005), (0.52, 0.32, 0.19), "Hips", 0.025)
    box(pants, "voxel_left_thigh", (-0.19, 0.0, 0.735), (0.23, 0.27, 0.49), "LeftUpLeg", 0.025)
    box(pants, "voxel_right_thigh", (0.19, 0.0, 0.735), (0.23, 0.27, 0.49), "RightUpLeg", 0.025)
    box(pants, "voxel_left_sock", (-0.19, 0.0, 0.30), (0.17, 0.19, 0.42), "LeftLeg", 0.018)
    box(pants, "voxel_right_sock", (0.19, 0.0, 0.30), (0.17, 0.19, 0.42), "RightLeg", 0.018)

    box(skin, "voxel_neck", (0.0, 0.0, 1.505), (0.15, 0.15, 0.13), "neck", 0.018)
    parts_by_material[skin].append(create_head_part(materials[skin]))
    box(skin, "voxel_left_forearm", (-0.57, 0.0, 0.845), (0.17, 0.19, 0.29), "LeftForeArm", 0.02)
    box(skin, "voxel_right_forearm", (0.57, 0.0, 0.845), (0.17, 0.19, 0.29), "RightForeArm", 0.02)
    box(skin, "voxel_left_hand", (-0.57, -0.005, 0.635), (0.18, 0.18, 0.16), "LeftHand", 0.025)
    box(skin, "voxel_right_hand", (0.57, -0.005, 0.635), (0.18, 0.18, 0.16), "RightHand", 0.025)

    box(shoes, "voxel_left_cleat", (-0.19, -0.09, 0.075), (0.23, 0.39, 0.15), "LeftFoot", 0.025)
    box(shoes, "voxel_right_cleat", (0.19, -0.09, 0.075), (0.23, 0.39, 0.15), "RightFoot", 0.025)

    return [
        join_material_parts(material_name, parts_by_material[material_name], armature)
        for material_name in MATERIAL_SPECS
    ]


def create_preview_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = 0.9
    return material


def add_preview_stage() -> None:
    field_material = create_preview_material("preview_field", (0.018, 0.12, 0.055, 1.0))
    line_material = create_preview_material("preview_yard_line", (0.82, 0.88, 0.84, 1.0))
    bpy.ops.mesh.primitive_plane_add(size=10.0, location=(0.0, 0.0, -0.003))
    ground = bpy.context.object
    ground.name = "MCP_Preview_Field"
    ground.data.materials.append(field_material)
    for x_position in (-1.5, 1.5):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_position, 0.0, 0.004))
        line = bpy.context.object
        line.name = "MCP_Preview_YardLine"
        line.scale = (0.035, 4.5, 0.006)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        line.data.materials.append(line_material)


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera_and_lights() -> bpy.types.Object:
    camera_data = bpy.data.cameras.new("MCP_Voxel_Player_Camera")
    camera = bpy.data.objects.new("MCP_Voxel_Player_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.data.lens = 58
    camera.data.sensor_width = 36
    bpy.context.scene.camera = camera

    def area(name: str, location: tuple[float, float, float], energy: float, size: float, color: tuple[float, float, float]) -> None:
        data = bpy.data.lights.new(name=name, type="AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = location
        point_at(light, (0.0, 0.0, 1.05))

    area("MCP_Key", (3.2, -4.0, 4.8), 950.0, 3.0, (1.0, 0.91, 0.78))
    area("MCP_Fill", (-3.8, -1.5, 2.7), 650.0, 3.5, (0.55, 0.72, 1.0))
    area("MCP_Rim", (1.8, 3.0, 4.0), 800.0, 2.5, (0.55, 0.75, 1.0))
    return camera


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.006, 0.012, 0.025)
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def render_pose(camera: bpy.types.Object, location: tuple[float, float, float], output_path: Path) -> None:
    camera.location = location
    point_at(camera, (0.0, 0.0, 1.0))
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


def count_triangles(meshes: list[bpy.types.Object]) -> int:
    return sum(
        max(0, len(polygon.vertices) - 2)
        for obj in meshes
        for polygon in obj.data.polygons
    )


def calculate_bounds(meshes: list[bpy.types.Object]) -> dict[str, dict[str, float]]:
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    size = maximum - minimum
    return {
        "minBlenderXYZ": {"x": minimum.x, "y": minimum.y, "z": minimum.z},
        "maxBlenderXYZ": {"x": maximum.x, "y": maximum.y, "z": maximum.z},
        "sizeBlenderXYZ": {"x": size.x, "y": size.y, "z": size.z},
    }


def export_runtime(armature: bpy.types.Object, meshes: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


def write_manifest(armature: bpy.types.Object, meshes: list[bpy.types.Object]) -> dict[str, object]:
    glb_hash = hashlib.sha256(GLB_PATH.read_bytes()).hexdigest()
    triangle_count = count_triangles(meshes)
    bounds = calculate_bounds(meshes)
    bone_names = sorted(bone.name for bone in armature.data.bones)
    manifest = {
        "animationCount": 0,
        "assetId": "football-js-player-base",
        "assetVersion": 1,
        "boneNames": bone_names,
        "bounds": bounds,
        "contentHashes": {"player-base-rigged.glb": glb_hash},
        "createdWith": {
            "blender": bpy.app.version_string,
            "mcp": "Blender Lab MCP v1.0.0",
            "mcpSourceCommit": "03004fd0216bfe5e0a3d9ac9b47d5efadc3d78c4",
        },
        "drawCallTarget": len(meshes),
        "heightMeters": 1.85,
        "materialRegionNames": list(MATERIAL_SPECS),
        "orientation": {"forward": "+Z", "up": "+Y"},
        "roundedHead": {
            "centerY": 1.695,
            "diameterMeters": 0.31,
            "helmetSocketY": 1.84,
        },
        "socketNames": sorted(SOCKET_SPECS),
        "style": "rigid-weighted voxel football player",
        "triangleCount": triangle_count,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def build() -> dict[str, object]:
    for directory in (RUNTIME_DIR, SOURCE_DIR, ARTIFACT_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    clear_scene()
    materials = {
        name: create_material(name, color)
        for name, color in MATERIAL_SPECS.items()
    }
    armature = create_armature()
    meshes = create_player_meshes(armature, materials)
    add_preview_stage()
    camera = add_camera_and_lights()
    configure_render()

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    export_runtime(armature, meshes)
    manifest = write_manifest(armature, meshes)
    render_pose(camera, (0.0, -4.2, 1.75), BLENDER_FRONT_PATH)
    render_pose(camera, (3.1, -4.0, 2.15), BLENDER_QUARTER_PATH)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    return {
        "assetId": manifest["assetId"],
        "blendPath": str(BLEND_PATH),
        "boneCount": len(manifest["boneNames"]),
        "glbPath": str(GLB_PATH),
        "manifestPath": str(MANIFEST_PATH),
        "meshCount": len(meshes),
        "screenshots": [str(BLENDER_FRONT_PATH), str(BLENDER_QUARTER_PATH)],
        "socketCount": len(manifest["socketNames"]),
        "triangleCount": manifest["triangleCount"],
    }


RESULT = build()
result = RESULT
