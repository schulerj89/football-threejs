import argparse
import json
from pathlib import Path

import bpy


REQUIRED_MESHES = {"helmet_shell", "faceguard_standard"}
REQUIRED_MATERIALS = {"mat_helmet_shell", "mat_faceguard"}
MAX_TOTAL_TRIANGLES = 8500


def parse_args():
    parser = argparse.ArgumentParser(description="Validate a prepared Football JS modular helmet kit.")
    parser.add_argument("--kit", required=True)
    parser.add_argument("--shell", required=True)
    parser.add_argument("--faceguard", required=True)
    parser.add_argument("--report", required=True)
    args, _ = parser.parse_known_args()
    return args


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.context.scene.objects if obj not in before]


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def triangle_count(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def material_names(meshes):
    names = set()
    for obj in meshes:
        for material in obj.data.materials:
            if material:
                names.add(material.name)
    return names


def validate():
    args = parse_args()
    failures = []
    clear_scene()
    kit_objects = import_glb(Path(args.kit))
    kit_meshes = mesh_objects(kit_objects)
    kit_mesh_names = {obj.name for obj in kit_meshes}
    kit_materials = material_names(kit_meshes)
    total_triangles = sum(triangle_count(obj) for obj in kit_meshes)

    if not REQUIRED_MESHES.issubset(kit_mesh_names):
        failures.append(f"Missing required meshes: {sorted(REQUIRED_MESHES - kit_mesh_names)}")
    if not REQUIRED_MATERIALS.issubset(kit_materials):
        failures.append(f"Missing required materials: {sorted(REQUIRED_MATERIALS - kit_materials)}")
    if total_triangles > MAX_TOTAL_TRIANGLES:
        failures.append(f"Triangle count {total_triangles} exceeds {MAX_TOTAL_TRIANGLES}")

    clear_scene()
    shell_meshes = mesh_objects(import_glb(Path(args.shell)))
    shell_names = {obj.name for obj in shell_meshes}
    if shell_names != {"helmet_shell"}:
        failures.append(f"Standalone shell contains unexpected meshes: {sorted(shell_names)}")

    clear_scene()
    faceguard_meshes = mesh_objects(import_glb(Path(args.faceguard)))
    faceguard_names = {obj.name for obj in faceguard_meshes}
    if faceguard_names != {"faceguard_standard"}:
        failures.append(f"Standalone faceguard contains unexpected meshes: {sorted(faceguard_names)}")

    report = {
        "failures": failures,
        "kitMaterialNames": sorted(kit_materials),
        "kitMeshNames": sorted(kit_mesh_names),
        "passed": not failures,
        "totalTriangles": total_triangles,
    }
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    validate()
