# Blender MCP Setup & Usage Guide

Complete guide to installing, configuring, and using Blender MCP for 3D print preparation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration for Claude Desktop](#configuration-for-claude-desktop)
4. [Configuration for Cursor / VS Code](#configuration-for-cursor--vs-code)
5. [Connecting Hyper3D Rodin](#connecting-hyper3d-rodin)
6. [Print Cleanup Workflow](#print-cleanup-workflow)
7. [Blender Python Commands Reference](#blender-python-commands-reference)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Blender 3.6+** (free from blender.org)
- **Python 3.10+**
- **uv package manager** (for running the MCP server)
- **Claude Desktop**, **Cursor**, or **VS Code** with Claude extension
- **Anthropic API subscription** (Claude Pro or API key)

---

## Installation

### Step 1: Install uv (package manager)

macOS / Linux:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Windows (PowerShell):
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Step 2: Install Blender Addon

1. Download `addon.py` from https://github.com/ahujasid/blender-mcp
2. Open Blender → Edit → Preferences → Add-ons
3. Click "Install..." and select the downloaded `addon.py`
4. Enable the addon by checking the box next to "Interface: Blender MCP"

### Step 3: Start the MCP Server in Blender

1. In Blender, press `N` to open the 3D View sidebar
2. Select the "BlenderMCP" tab
3. (Optional) Enable "Poly Haven" checkbox for access to HDRIs, textures, and models
4. Click "Start MCP Server"
5. You should see "MCP Server started on port 9876"

The server runs inside Blender and listens for commands from Claude.

---

## Configuration for Claude Desktop

Edit your Claude Desktop config file:

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add the Blender MCP server:

```json
{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["blender-mcp"]
    }
  }
}
```

Restart Claude Desktop. You should see a hammer icon indicating the Blender MCP tools are available.

**Important**: Do NOT run `uvx blender-mcp` manually in a terminal. Claude Desktop manages the MCP server
process. Just configure the JSON and restart.

---

## Configuration for Cursor / VS Code

### Cursor
Add to your Cursor MCP settings (Settings → MCP Servers):

```json
{
  "blender": {
    "command": "uvx",
    "args": ["blender-mcp"]
  }
}
```

### VS Code
Install the Claude extension, then add to your VS Code settings:

```json
{
  "claude.mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["blender-mcp"]
    }
  }
}
```

**Important**: Only run ONE MCP server instance at a time. Do not open it simultaneously in
Claude Desktop, Cursor, and VS Code.

---

## Connecting Hyper3D Rodin

Blender MCP integrates with Hyper3D Rodin for image-to-3D model generation. This is
how your Nano Banana reference images become 3D meshes.

### Free Tier
Blender MCP includes a free trial key for Hyper3D that allows a limited number of
generations per day. For the pipeline to work:

1. Ensure Blender MCP addon is running
2. In Claude, say: "Generate a 3D model from this reference image using Hyper3D"
3. Provide the image (paste or reference file path)
4. Hyper3D returns a mesh that gets imported directly into Blender

### Custom API Key
For higher limits, get your own key from hyper3d.ai and/or fal.ai, then configure
it in the Blender MCP addon preferences.

### Multi-View Reconstruction
For best results with 4 reference views:

1. Load all 4 reference images as background images in Blender (front, side, etc.)
2. Tell Claude: "Use these 4 reference views to generate a 3D model with Hyper3D"
3. Alternatively, use the multi-view sheet (single image with 4 views) for simpler input

---

## Print Cleanup Workflow

After mesh reconstruction, follow this sequence to prepare for printing.
Use these commands through Claude with Blender MCP active:

### Phase 1: Inspection
```
"Get information about the current scene"
"What are the mesh statistics — vertex count, face count, non-manifold edges?"
"Take a screenshot of the current viewport"
```

### Phase 2: Geometry Repair
```
"Select all mesh objects and enter edit mode"
"Select non-manifold edges and fill holes"
"Remove duplicate vertices with merge distance 0.001"
"Recalculate all normals to point outward"
"Remove internal faces and loose vertices"
"Remove any zero-area faces"
```

### Phase 3: Printability Optimization

**For FDM:**
```
"Add a cylinder base under the object, 2mm height, diameter matching the object footprint"
"Boolean union the base with the main object"
"Apply a 1mm chamfer to the bottom edge of the base"
"Check for overhangs greater than 45 degrees and highlight them"
"Apply subdivision surface modifier level 1 if the mesh is too angular"
"Ensure minimum wall thickness is 1.2mm throughout"
```

**For Resin/SLA:**
```
"Add a solidify modifier with 1.5mm thickness to hollow the model"
"Add two 1mm drain holes at the lowest points of the hollowed model"
"Apply the modifier"
"The mesh should be watertight — verify and fix if needed"
```

**For SLS:**
```
"Ensure minimum wall thickness of 0.7mm"
"Add 2mm escape holes for any enclosed volumes where powder could be trapped"
"No supports needed — verify geometry is self-supporting"
```

### Phase 4: Scale and Export
```
"Set the object dimensions so the tallest axis is exactly [X] centimeters"
"Apply all transforms (location, rotation, scale)"
"Apply all modifiers"
"Export as STL to /path/to/output/model.stl"
```

---

## Blender Python Commands Reference

These are the underlying bpy commands that Claude executes through Blender MCP.
Useful for understanding what's happening under the hood, or for manual intervention.

### Manifold Check
```python
import bmesh
bm = bmesh.from_edit_mesh(bpy.context.object.data)
non_manifold = [e for e in bm.edges if not e.is_manifold]
print(f"Non-manifold edges: {len(non_manifold)}")
```

### Auto-Fix Mesh
```python
import bmesh
obj = bpy.context.active_object
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.mesh.remove_doubles(threshold=0.001)
bpy.ops.mesh.fill_holes(sides=0)
bpy.ops.object.mode_set(mode='OBJECT')
```

### Add Print Base
```python
import bpy
obj = bpy.context.active_object
dims = obj.dimensions
# Create base cylinder
bpy.ops.mesh.primitive_cylinder_add(
    radius=max(dims.x, dims.y) / 2 + 0.002,
    depth=0.002,  # 2mm base
    location=(obj.location.x, obj.location.y, obj.location.z - dims.z / 2 - 0.001)
)
```

### Export STL with Scale
```python
# Set scale to desired size (e.g., 50mm tall)
target_height = 0.05  # 50mm in Blender units (meters)
current_height = bpy.context.active_object.dimensions.z
scale_factor = target_height / current_height
bpy.context.active_object.scale *= scale_factor
bpy.ops.object.transform_apply(scale=True)

# Export
bpy.ops.wm.stl_export(
    filepath="/path/to/output/model.stl",
    export_selected_objects=True,
    apply_modifiers=True,
)
```

---

## Troubleshooting

### "MCP server not found" in Claude Desktop
- Ensure `uv` is installed and in your PATH
- Restart Claude Desktop completely (quit and reopen)
- Verify the config JSON is valid (no trailing commas)

### "Connection refused" when sending commands
- Make sure "Start MCP Server" was clicked in Blender's sidebar
- Check port 9876 is not used by another application
- Try stopping and restarting the MCP server in Blender

### First command fails, then it works
- This is a known issue. The first command after connecting often fails.
  Just retry — subsequent commands should work reliably.

### Hyper3D daily limit reached
- The free trial key has daily limits
- Wait for next day's reset, or get your own key from hyper3d.ai
- Alternative: use TripoSR or InstantMesh for reconstruction

### Blender crashes during complex operations
- Save frequently (Blender MCP can execute arbitrary code)
- Break complex operations into smaller steps
- Check Blender's system console for error messages

### Mesh has millions of faces after reconstruction
- Apply decimate modifier: "Decimate the mesh to 50000 faces using collapse method"
- Or use remesh: "Apply remesh modifier with voxel size 0.5mm"
- Simpler meshes are faster to slice and often print better

### STL scale is wrong
- Blender uses meters internally; most slicers expect millimeters
- Set dimensions explicitly before export: "Make the object exactly 50mm tall"
- Some slicers have an auto-scale option on import
