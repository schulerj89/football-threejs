import argparse
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


SHELL_NAME = "helmet_shell"
FACEGUARD_NAME = "faceguard_standard"
ROOT_NAME = "footballHelmetRoot"
SHELL_MATERIAL = "mat_helmet_shell"
FACEGUARD_MATERIAL = "mat_faceguard"


def parse_args():
    parser = argparse.ArgumentParser(description="Prepare a modular Football JS helmet GLB.")
    parser.add_argument("--input", required=True, help="Generated Meshy GLB candidate.")
    parser.add_argument("--output-dir", required=True, help="Prepared output directory.")
    parser.add_argument("--public-dir", required=True, help="Runtime public/models/helmet directory.")
    parser.add_argument("--candidate-id", required=True, help="Source candidate ID.")
    args, _ = parser.parse_known_args()
    return args


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Generated candidate contains no mesh objects")
    return meshes


def apply_transforms(meshes):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def separate_loose_parts(meshes):
    separated = []
    for obj in list(meshes):
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.mesh.separate(type="LOOSE")
        separated.extend([candidate for candidate in bpy.context.selected_objects if candidate.type == "MESH"])
    return list({obj.name: obj for obj in separated}.values())


def classify_components(components):
    bounds = {obj: world_bounds(obj) for obj in components}
    shell = []
    faceguard = []
    for obj, (min_v, max_v) in bounds.items():
        size = max_v - min_v
        center = (min_v + max_v) * 0.5
        is_bar_like = min(size.x, size.y, size.z) < max(size.x, size.y, size.z) * 0.22
        is_front = center.z > -0.05
        if is_bar_like and is_front:
            faceguard.append(obj)
        else:
            shell.append(obj)
    if not shell or not faceguard:
        raise RuntimeError(
            "Unable to classify separate shell and faceguard components. "
            "Reject this Meshy candidate rather than cutting a fused model."
        )
    return shell, faceguard


def join_as(name, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    return joined


def assign_material(obj, name, color):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.68
        bsdf.inputs["Metallic"].default_value = 0.02
    obj.data.materials.clear()
    obj.data.materials.append(material)


def normalize_fit(objects):
    min_v, max_v = combined_bounds(objects)
    center = (min_v + max_v) * 0.5
    size = max_v - min_v
    target_height = 0.78
    scale = target_height / max(size.y, 0.0001)
    for obj in objects:
        obj.location -= center
        obj.scale *= scale
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def triangulate(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new("helmet_runtime_triangulate", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def create_root(children):
    root = bpy.data.objects.new(ROOT_NAME, None)
    bpy.context.collection.objects.link(root)
    for child in children:
        child.parent = root
        child.matrix_parent_inverse.identity()
    return root


def export_glb(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
    )


def triangle_count(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def vertex_count(obj):
    return len(obj.data.vertices)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_v = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    max_v = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return min_v, max_v


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


def vector_plain(vector):
    return {"x": vector.x, "y": vector.y, "z": vector.z}


def main():
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    public_dir = Path(args.public_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    meshes = import_glb(input_path)
    apply_transforms(meshes)
    components = separate_loose_parts(meshes)
    shell_components, faceguard_components = classify_components(components)
    shell = join_as(SHELL_NAME, shell_components)
    faceguard = join_as(FACEGUARD_NAME, faceguard_components)
    assign_material(shell, SHELL_MATERIAL, (0.93, 0.93, 0.9, 1.0))
    assign_material(faceguard, FACEGUARD_MATERIAL, (0.12, 0.13, 0.14, 1.0))
    normalize_fit([shell, faceguard])
    triangulate(shell)
    triangulate(faceguard)
    root = create_root([shell, faceguard])

    combined_path = public_dir / "football-helmet-kit.glb"
    shell_path = public_dir / "helmet-shell.glb"
    faceguard_path = public_dir / "faceguard-standard.glb"
    export_glb(combined_path, [root, shell, faceguard])
    export_glb(shell_path, [shell])
    export_glb(faceguard_path, [faceguard])

    min_v, max_v = combined_bounds([shell, faceguard])
    size = max_v - min_v
    fit_spec = {
        "candidateId": args.candidate_id,
        "faceOpeningHeight": round(size.y * 0.52, 5),
        "faceOpeningWidth": round(size.x * 0.58, 5),
        "forwardAxis": "+Z",
        "origin": {"x": 0, "y": 0, "z": 0},
        "recommendedHeadAnchorOffset": {"x": 0, "y": 0, "z": 0},
        "recommendedScale": 1,
        "shellDepth": round(size.z, 5),
        "totalHeight": round(size.y, 5),
        "totalWidth": round(size.x, 5),
    }
    (public_dir / "helmet-fit-spec.json").write_text(json.dumps(fit_spec, indent=2) + "\n", encoding="utf8")
    manifest = {
        "assetId": "football-helmet-kit",
        "assetVersion": 1,
        "sourceCandidate": args.candidate_id,
        "meshNames": [SHELL_NAME, FACEGUARD_NAME],
        "materialNames": [SHELL_MATERIAL, FACEGUARD_MATERIAL],
        "totalTriangles": triangle_count(shell) + triangle_count(faceguard),
        "shellTriangles": triangle_count(shell),
        "faceguardTriangles": triangle_count(faceguard),
        "vertexCounts": {
            SHELL_NAME: vertex_count(shell),
            FACEGUARD_NAME: vertex_count(faceguard),
        },
        "bounds": {
            "min": vector_plain(min_v),
            "max": vector_plain(max_v),
            "size": vector_plain(size),
        },
        "origin": {"x": 0, "y": 0, "z": 0},
        "orientation": {"up": "+Y", "forward": "+Z"},
        "recommendedScale": 1,
        "recommendedHeadAnchorOffset": {"x": 0, "y": 0, "z": 0},
        "preparationTimestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    (public_dir / "helmet-kit-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
