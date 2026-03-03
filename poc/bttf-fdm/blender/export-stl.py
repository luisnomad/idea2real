import bpy

# Save .blend file
blend_path = "/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/idea2real/poc/bttf-fdm/blender/delorean-bttf.blend"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Saved: {blend_path}")

# Export STL (global_scale=1000 converts Blender meters to mm for slicers)
stl_path = "/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/idea2real/poc/bttf-fdm/export/delorean-bttf-1-32.stl"
obj = bpy.data.objects["DeLorean_BTTF"]
for o in bpy.data.objects:
    o.select_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.wm.stl_export(filepath=stl_path, export_selected_objects=True, global_scale=1000.0)
print(f"Exported STL: {stl_path}")
print("Done!")
