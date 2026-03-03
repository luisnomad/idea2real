bl_info = {
    "name": "idea2real by NotJustPrompts",
    "author": "NotJustPrompts",
    "description": "AI-powered 3D print pipeline: image → Hunyuan 3D reconstruction → print-ready cleanup → STL export",
    "version": (0, 3, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > idea2real",
    "category": "3D View",
}

import bpy
import bpy.utils.previews
import os
import json
import base64
import threading
import tempfile
import time
import math
from bpy.props import (
    StringProperty, EnumProperty, FloatProperty, BoolProperty,
    IntProperty, CollectionProperty, PointerProperty
)
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# =============================================================================
# CONSTANTS
# =============================================================================

POLL_INTERVAL = 3.0  # seconds between API polling attempts
MAX_POLL_ATTEMPTS = 200  # max ~10 minutes of polling

FAL_BASE = "https://queue.fal.run"
FAL_MODELS = {
    "NANO_BANANA_2": "fal-ai/nano-banana-2",
    "NANO_BANANA_PRO": "fal-ai/nano-banana-pro/text-to-image",
}
FAL_HUNYUAN = "fal-ai/hunyuan3d-v3/image-to-3d"


# =============================================================================
# UTILITIES
# =============================================================================

def get_prefs():
    """Get addon preferences (API keys)."""
    return bpy.context.preferences.addons[__name__].preferences


def get_props():
    """Get scene-level addon properties."""
    return bpy.context.scene.nb3dp


def image_to_base64(filepath):
    """Read an image file and return a base64 data URI."""
    ext = os.path.splitext(filepath)[1].lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".webp": "image/webp", ".bmp": "image/bmp"}
    mime = mime_map.get(ext, "image/png")
    with open(bpy.path.abspath(filepath), "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{data}"


def image_to_base64_raw(filepath):
    """Read an image file and return raw base64 string (no data URI prefix)."""
    with open(bpy.path.abspath(filepath), "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def api_request(url, data=None, headers=None, method="POST"):
    """Make an HTTP request and return parsed JSON."""
    if data is not None:
        data = json.dumps(data).encode("utf-8")
    req = Request(url, data=data, headers=headers or {}, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"API error {e.code}: {body}")


def download_file(url, dest):
    """Download a file from URL to local path."""
    req = Request(url)
    with urlopen(req, timeout=300) as resp:
        with open(dest, "wb") as f:
            f.write(resp.read())
    return dest


def set_status(msg):
    """Thread-safe status update via timer."""
    def _update():
        try:
            bpy.context.scene.nb3dp.status_message = msg
        except:
            pass
        return None
    bpy.app.timers.register(_update, first_interval=0.0)


def set_processing(state):
    """Thread-safe processing flag update."""
    def _update():
        try:
            bpy.context.scene.nb3dp.is_processing = state
        except:
            pass
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.tag_redraw()
        return None
    bpy.app.timers.register(_update, first_interval=0.0)


def set_progress(percent):
    """Thread-safe progress update."""
    def _update():
        try:
            bpy.context.scene.nb3dp.progress_percent = percent
        except:
            pass
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.tag_redraw()
        return None
    bpy.app.timers.register(_update, first_interval=0.0)


def redraw_ui():
    """Force UI redraw."""
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.tag_redraw()


def _save_request_id(request_id):
    """Thread-safe save of fal.ai request ID for resume support."""
    def _update():
        try:
            bpy.context.scene.nb3dp.last_request_id = request_id
        except:
            pass
        return None
    bpy.app.timers.register(_update, first_interval=0.0)


def mesh_stats(obj):
    """Return a string with vertex and face counts for a mesh object."""
    if obj and obj.type == 'MESH':
        verts = len(obj.data.vertices)
        faces = len(obj.data.polygons)
        return f"{verts:,} verts, {faces:,} faces"
    return "N/A"


# =============================================================================
# API CLIENT — fal.ai only
# =============================================================================

class FalClient:
    """Client for fal.ai API (queue-based)."""

    @staticmethod
    def submit(model_id, payload, api_key):
        """Submit a job and return the request ID."""
        url = f"{FAL_BASE}/{model_id}"
        headers = {"Authorization": f"Key {api_key}"}
        result = api_request(url, data=payload, headers=headers)
        if "request_id" in result:
            return result["request_id"]
        return result

    @staticmethod
    def poll(model_id, request_id, api_key):
        """Poll for job completion. Returns result dict or None if still processing."""
        url = f"{FAL_BASE}/{model_id}/requests/{request_id}/status"
        headers = {"Authorization": f"Key {api_key}"}
        try:
            result = api_request(url, headers=headers, method="GET", data=None)
        except Exception:
            return None

        status = result.get("status", "")
        if status == "COMPLETED":
            result_url = f"{FAL_BASE}/{model_id}/requests/{request_id}"
            return api_request(result_url, headers=headers, method="GET", data=None)
        elif status in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"fal.ai job {status}: {result.get('error', 'unknown')}")
        return None

    @staticmethod
    def generate_image(prompt, api_key, model="NANO_BANANA_2", reference_images=None,
                       aspect_ratio="1:1"):
        """Generate an image via Nano Banana. Returns image URL."""
        model_id = FAL_MODELS[model]
        payload = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "output_format": "png",
        }
        if reference_images:
            payload["image_url"] = reference_images[0]
            if len(reference_images) > 1:
                payload["reference_images"] = reference_images[1:]

        submission = FalClient.submit(model_id, payload, api_key)

        if isinstance(submission, dict) and "images" in submission:
            return submission["images"][0]["url"]

        request_id = submission
        for attempt in range(MAX_POLL_ATTEMPTS):
            time.sleep(POLL_INTERVAL)
            set_progress(int((attempt + 1) / MAX_POLL_ATTEMPTS * 100))
            result = FalClient.poll(model_id, request_id, api_key)
            if result is not None:
                return result["images"][0]["url"]

        raise RuntimeError("Timed out waiting for image generation")

    @staticmethod
    def generate_3d(image_path, api_key, face_count=500000, enable_pbr=False):
        """Generate a 3D model via Hunyuan3D v3 on fal.ai. Returns model file URL."""
        generate_type = "Normal" if enable_pbr else "Geometry"
        payload = {
            "input_image_url": image_to_base64(image_path),
            "face_count": face_count,
            "enable_pbr": enable_pbr,
            "generate_type": generate_type,
        }
        submission = FalClient.submit(FAL_HUNYUAN, payload, api_key)

        if isinstance(submission, dict) and "model_mesh" in submission:
            return submission["model_mesh"]["url"]

        request_id = submission
        # Save request_id so we can resume if polling times out
        _save_request_id(request_id)
        return FalClient._poll_3d_result(request_id, api_key)

    @staticmethod
    def resume_3d(request_id, api_key):
        """Resume polling for an existing 3D generation job."""
        return FalClient._poll_3d_result(request_id, api_key)

    @staticmethod
    def _poll_3d_result(request_id, api_key):
        """Poll for 3D generation result. Returns mesh URL or raises on timeout."""
        for attempt in range(MAX_POLL_ATTEMPTS):
            time.sleep(POLL_INTERVAL)
            pct = int((attempt + 1) / MAX_POLL_ATTEMPTS * 100)
            set_progress(pct)
            set_status(f"Generating 3D model... {pct}%")
            result = FalClient.poll(FAL_HUNYUAN, request_id, api_key)
            if result is not None:
                if "model_mesh" in result:
                    return result["model_mesh"]["url"]
                elif "mesh" in result:
                    return result["mesh"]["url"]
                for key, val in result.items():
                    if isinstance(val, dict) and "url" in val:
                        return val["url"]
                    if isinstance(val, str) and val.startswith("http"):
                        return val
                raise RuntimeError(f"Unexpected Hunyuan response format: {list(result.keys())}")

        raise TimeoutError(f"Timed out polling request {request_id}. Click 'Resume' to keep waiting.")


# =============================================================================
# PROPERTIES
# =============================================================================

def _on_input_image_changed(self, context):
    """Called when input_image_path changes. Loads image and generates preview icon."""
    path = self.input_image_path
    if not path:
        return
    abs_path = os.path.realpath(bpy.path.abspath(path))
    if not os.path.isfile(abs_path):
        return

    img_name = "NB3DP_Upload_Preview"
    old = bpy.data.images.get(img_name)
    if old:
        bpy.data.images.remove(old)

    try:
        img = bpy.data.images.load(abs_path, check_existing=False)
        img.name = img_name
        _generate_image_preview(img)
    except Exception:
        pass


def _generate_image_preview(img, icon_size=256):
    """Generate a preview icon from image pixel data for use with template_icon."""
    if not img or img.size[0] == 0:
        return
    preview = img.preview_ensure()
    preview.icon_size = (icon_size, icon_size)

    w, h = img.size
    pixels = img.pixels[:]

    icon_pixels = []
    for y in range(icon_size):
        src_y = int(y * h / icon_size)
        for x in range(icon_size):
            src_x = int(x * w / icon_size)
            idx = (src_y * w + src_x) * 4
            r = int(pixels[idx] * 255) & 0xFF
            g = int(pixels[idx + 1] * 255) & 0xFF
            b = int(pixels[idx + 2] * 255) & 0xFF
            a = int(pixels[idx + 3] * 255) & 0xFF
            val = r | (g << 8) | (b << 16) | (a << 24)
            if val >= 0x80000000:
                val -= 0x100000000
            icon_pixels.append(val)

    preview.icon_pixels = icon_pixels


def _get_ref_preview_collection():
    """Get the custom preview collection for reference images."""
    return getattr(bpy.types.Scene, "nb3dp_ref_previews", None)


def _load_ref_preview(filepath, key):
    """Load a reference image into the custom preview collection."""
    pcoll = _get_ref_preview_collection()
    if pcoll is None:
        return
    abs_path = os.path.realpath(bpy.path.abspath(filepath))
    if not os.path.isfile(abs_path):
        return
    # Remove existing entry if present
    if key in pcoll:
        del pcoll[key]
    try:
        pcoll.load(key, abs_path, 'IMAGE')
    except Exception:
        pass


def _renumber_ref_previews(props):
    """Re-number reference image previews after a removal to stay in sync."""
    pcoll = _get_ref_preview_collection()
    if pcoll is None:
        return
    pcoll.clear()
    for i, ref in enumerate(props.reference_images):
        _load_ref_preview(ref.filepath, f"ref_{i}")


class NB3DP_ReferenceImage(bpy.types.PropertyGroup):
    filepath: StringProperty(
        name="Image Path",
        subtype='FILE_PATH',
        description="Path to reference image"
    )


class NB3DP_Properties(bpy.types.PropertyGroup):

    # --- Image Generation ---
    nano_model: EnumProperty(
        name="Nano Banana Model",
        items=[
            ("NANO_BANANA_2", "Nano Banana 2", "Fast, good quality (~$0.08/image)"),
            ("NANO_BANANA_PRO", "Nano Banana Pro", "Highest quality (~$0.14/image)"),
        ],
        default="NANO_BANANA_2",
        description="Which Nano Banana model to use"
    )
    prompt: StringProperty(
        name="Prompt",
        description="Text prompt for image generation (type here or load from file)",
        default="",
        maxlen=8192,
    )
    prompt_file_path: StringProperty(
        name="Prompt File",
        subtype='FILE_PATH',
        description="Load prompt from a text file (.txt, .md, .json, .xml)",
    )
    aspect_ratio: EnumProperty(
        name="Aspect Ratio",
        items=[
            ("1:1", "1:1 (Square)", "Best for 3D reconstruction"),
            ("16:9", "16:9 (Wide)", "Landscape format"),
            ("9:16", "9:16 (Tall)", "Portrait format"),
            ("4:3", "4:3", "Classic format"),
        ],
        default="1:1"
    )
    reference_images: CollectionProperty(type=NB3DP_ReferenceImage)
    reference_images_index: IntProperty(default=0)

    # --- Source Image for 3D Generation ---
    input_image_path: StringProperty(
        name="Input Image",
        subtype='FILE_PATH',
        description="Image to convert to 3D model (upload directly or use generated image)",
        update=lambda self, ctx: _on_input_image_changed(self, ctx),
    )
    use_generated_as_input: BoolProperty(
        name="Use Generated Image",
        description="Use the last generated Nano Banana image as input for Hunyuan 3D",
        default=True
    )

    # --- 3D Generation (Hunyuan v3) ---
    face_count: IntProperty(
        name="Face Count",
        description="Target face count for the generated mesh",
        default=500000,
        min=40000,
        max=1500000,
    )
    enable_pbr: BoolProperty(
        name="Enable PBR Textures",
        description="Generate PBR materials (disable for print — geometry only is faster)",
        default=False
    )

    # --- Cleanup & Print ---
    print_tech: EnumProperty(
        name="Print Technology",
        items=[
            ("FDM", "FDM", "Fused Deposition Modeling — chunky, visible layers, PLA/PETG"),
            ("RESIN", "Resin / SLA", "Stereolithography — smooth, fine detail, resin"),
            ("SLS", "SLS", "Selective Laser Sintering — nylon powder, self-supporting"),
        ],
        default="FDM",
        description="Target 3D printing technology (affects cleanup operations)"
    )
    target_size_mm: FloatProperty(
        name="Target Size (mm)",
        description="Target size in mm for the longest dimension of the model",
        default=100.0,
        min=5.0,
        max=1000.0
    )
    add_base: BoolProperty(
        name="Add Print Base",
        description="Add a flat rectangular base for bed adhesion",
        default=True
    )
    base_thickness_mm: FloatProperty(
        name="Base Thickness (mm)",
        description="Thickness of the print base",
        default=2.0,
        min=0.5,
        max=10.0
    )
    hollow_model: BoolProperty(
        name="Hollow Model (Resin)",
        description="Hollow the model for resin printing to save material",
        default=False
    )
    wall_thickness_mm: FloatProperty(
        name="Wall Thickness (mm)",
        description="Wall thickness when hollowing",
        default=1.5,
        min=0.5,
        max=5.0
    )

    # --- State ---
    status_message: StringProperty(name="Status", default="Ready")
    is_processing: BoolProperty(name="Processing", default=False)
    progress_percent: IntProperty(
        name="Progress",
        description="Progress percentage for async operations",
        default=0,
        min=0,
        max=100,
        subtype='PERCENTAGE'
    )
    generated_image_path: StringProperty(name="Generated Image Path", default="")
    generated_mesh_path: StringProperty(name="Generated Mesh Path", default="")
    last_request_id: StringProperty(
        name="Last Request ID",
        description="fal.ai request ID from last 3D generation (for resume after timeout)",
        default=""
    )

    # --- Export ---
    export_path: StringProperty(
        name="Export Path",
        subtype='DIR_PATH',
        description="Directory to export STL files",
        default=os.path.join(os.path.expanduser("~"), "Documents"),
    )


# =============================================================================
# OPERATORS — REFERENCE IMAGES
# =============================================================================

class NB3DP_OT_AddReferenceImage(bpy.types.Operator):
    bl_idname = "nb3dp.add_reference_image"
    bl_label = "Add Reference Image"
    bl_description = "Add a reference image for I2I generation (up to 14)"

    filepath: StringProperty(subtype='FILE_PATH')
    filter_glob: StringProperty(default="*.png;*.jpg;*.jpeg;*.webp;*.bmp", options={'HIDDEN'})

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

    def execute(self, context):
        props = get_props()
        if len(props.reference_images) >= 14:
            self.report({'WARNING'}, "Maximum 14 reference images")
            return {'CANCELLED'}
        item = props.reference_images.add()
        item.filepath = self.filepath
        item.name = os.path.basename(self.filepath)

        # Generate preview thumbnail via custom preview collection
        idx = len(props.reference_images) - 1
        _load_ref_preview(self.filepath, f"ref_{idx}")
        return {'FINISHED'}


class NB3DP_OT_RemoveReferenceImage(bpy.types.Operator):
    bl_idname = "nb3dp.remove_reference_image"
    bl_label = "Remove Reference Image"
    bl_description = "Remove the selected reference image"

    index: IntProperty()

    def execute(self, context):
        props = get_props()
        props.reference_images.remove(self.index)
        _renumber_ref_previews(props)
        return {'FINISHED'}


class NB3DP_OT_ClearReferenceImages(bpy.types.Operator):
    bl_idname = "nb3dp.clear_reference_images"
    bl_label = "Clear All"
    bl_description = "Remove all reference images"

    def execute(self, context):
        props = get_props()
        pcoll = _get_ref_preview_collection()
        if pcoll:
            pcoll.clear()
        props.reference_images.clear()
        return {'FINISHED'}


# =============================================================================
# OPERATORS — PROMPT FILE
# =============================================================================

class NB3DP_OT_LoadPromptFile(bpy.types.Operator):
    bl_idname = "nb3dp.load_prompt_file"
    bl_label = "Load Prompt from File"
    bl_description = "Load prompt text from a .txt, .md, .json, or .xml file"

    filepath: StringProperty(subtype='FILE_PATH')
    filter_glob: StringProperty(default="*.txt;*.md;*.json;*.xml", options={'HIDDEN'})

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

    def execute(self, context):
        props = get_props()
        abs_path = bpy.path.abspath(self.filepath)
        if not os.path.isfile(abs_path):
            self.report({'ERROR'}, f"File not found: {abs_path}")
            return {'CANCELLED'}

        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
        except Exception as e:
            self.report({'ERROR'}, f"Could not read file: {e}")
            return {'CANCELLED'}

        if not content:
            self.report({'WARNING'}, "File is empty")
            return {'CANCELLED'}

        # Truncate if exceeding maxlen
        if len(content) > 8192:
            content = content[:8192]
            self.report({'WARNING'}, "Prompt truncated to 8192 characters")

        props.prompt = content
        props.prompt_file_path = self.filepath
        self.report({'INFO'}, f"Loaded prompt ({len(content)} chars) from {os.path.basename(self.filepath)}")
        return {'FINISHED'}


# =============================================================================
# OPERATORS — IMAGE GENERATION (Nano Banana)
# =============================================================================

class NB3DP_OT_GenerateImage(bpy.types.Operator):
    bl_idname = "nb3dp.generate_image"
    bl_label = "Generate Image"
    bl_description = "Generate an image using Nano Banana (T2I or I2I with references)"

    def execute(self, context):
        props = get_props()
        prefs = get_prefs()

        if not props.prompt.strip():
            self.report({'ERROR'}, "Please enter a prompt")
            return {'CANCELLED'}

        api_key = prefs.fal_api_key
        if not api_key:
            self.report({'ERROR'}, "Please set your fal.ai API key in addon preferences")
            return {'CANCELLED'}

        props.is_processing = True
        props.progress_percent = 0
        props.status_message = "Generating image..."

        ref_images = []
        for ref in props.reference_images:
            if ref.filepath and os.path.exists(bpy.path.abspath(ref.filepath)):
                ref_images.append(image_to_base64(ref.filepath))

        thread = threading.Thread(
            target=self._generate,
            args=(props.prompt, api_key, props.nano_model,
                  ref_images, props.aspect_ratio),
            daemon=True
        )
        thread.start()
        return {'FINISHED'}

    @staticmethod
    def _generate(prompt, api_key, model, reference_images, aspect_ratio):
        try:
            image_url = FalClient.generate_image(
                prompt, api_key, model=model,
                reference_images=reference_images if reference_images else None,
                aspect_ratio=aspect_ratio,
            )

            tmp_dir = tempfile.mkdtemp(prefix="nb3dp_")
            dest = os.path.join(tmp_dir, "generated.png")
            download_file(image_url, dest)

            def _load_preview():
                props = bpy.context.scene.nb3dp
                props.generated_image_path = dest
                props.status_message = f"Image generated: {dest}"
                props.is_processing = False
                props.progress_percent = 100

                img_name = "NB3DP_Generated"
                if img_name in bpy.data.images:
                    bpy.data.images.remove(bpy.data.images[img_name])
                bpy.data.images.load(dest, check_existing=False)
                bpy.data.images[-1].name = img_name

                redraw_ui()
                return None

            bpy.app.timers.register(_load_preview, first_interval=0.0)

        except Exception as e:
            set_status(f"Error: {str(e)[:100]}")
            set_processing(False)


class NB3DP_OT_UseGeneratedImage(bpy.types.Operator):
    bl_idname = "nb3dp.use_generated_image"
    bl_label = "Use as 3D Input"
    bl_description = "Use the generated Nano Banana image as input for Hunyuan 3D"

    def execute(self, context):
        props = get_props()
        if not props.generated_image_path:
            self.report({'WARNING'}, "No generated image available")
            return {'CANCELLED'}
        props.input_image_path = props.generated_image_path
        props.use_generated_as_input = True
        self.report({'INFO'}, "Generated image set as 3D input")
        return {'FINISHED'}


# =============================================================================
# OPERATORS — 3D GENERATION (Hunyuan v3)
# =============================================================================

class NB3DP_OT_Generate3D(bpy.types.Operator):
    bl_idname = "nb3dp.generate_3d"
    bl_label = "Generate 3D Model"
    bl_description = "Send image to Hunyuan3D v3 and import the result"

    def execute(self, context):
        props = get_props()
        prefs = get_prefs()

        # Prefer uploaded image; fall back to generated image
        image_path = props.input_image_path
        if not image_path or not os.path.exists(bpy.path.abspath(image_path)):
            image_path = props.generated_image_path
        if not image_path or not os.path.exists(bpy.path.abspath(image_path)):
            self.report({'ERROR'}, "No input image. Upload or generate one first.")
            return {'CANCELLED'}

        api_key = prefs.fal_api_key
        if not api_key:
            self.report({'ERROR'}, "Please set your fal.ai API key in addon preferences")
            return {'CANCELLED'}

        props.is_processing = True
        props.progress_percent = 0
        props.status_message = "Generating 3D model (this may take 1-3 minutes)..."

        thread = threading.Thread(
            target=self._generate_3d,
            args=(bpy.path.abspath(image_path), api_key,
                  props.face_count, props.enable_pbr),
            daemon=True
        )
        thread.start()
        return {'FINISHED'}

    @staticmethod
    def _generate_3d(image_path, api_key, face_count, enable_pbr):
        try:
            mesh_url = FalClient.generate_3d(
                image_path, api_key,
                face_count=face_count,
                enable_pbr=enable_pbr,
            )
            NB3DP_OT_Generate3D._download_and_import(mesh_url)

        except TimeoutError as e:
            # Job is still running on fal.ai — let user resume
            set_status(f"Timed out — job still running on fal.ai. Click 'Resume Polling'.")
            set_processing(False)
        except Exception as e:
            set_status(f"Error: {str(e)[:100]}")
            set_processing(False)

    @staticmethod
    def _resume_3d(request_id, api_key):
        try:
            mesh_url = FalClient.resume_3d(request_id, api_key)
            NB3DP_OT_Generate3D._download_and_import(mesh_url)

        except TimeoutError:
            set_status(f"Still waiting — job running on fal.ai. Click 'Resume Polling' again.")
            set_processing(False)
        except Exception as e:
            set_status(f"Error: {str(e)[:100]}")
            set_processing(False)

    @staticmethod
    def _download_and_import(mesh_url):
        """Download mesh from URL and import into Blender."""
        tmp_dir = tempfile.mkdtemp(prefix="nb3dp_mesh_")
        ext = ".glb"
        if ".obj" in mesh_url.lower():
            ext = ".obj"
        elif ".fbx" in mesh_url.lower():
            ext = ".fbx"
        elif ".stl" in mesh_url.lower():
            ext = ".stl"

        mesh_path = os.path.join(tmp_dir, f"hunyuan_output{ext}")
        download_file(mesh_url, mesh_path)

        def _import_mesh():
            props = bpy.context.scene.nb3dp
            props.generated_mesh_path = mesh_path
            props.last_request_id = ""  # Clear — job is done

            try:
                if ext == ".glb":
                    bpy.ops.import_scene.gltf(filepath=mesh_path)
                elif ext == ".obj":
                    bpy.ops.wm.obj_import(filepath=mesh_path)
                elif ext == ".fbx":
                    bpy.ops.import_scene.fbx(filepath=mesh_path)
                elif ext == ".stl":
                    bpy.ops.wm.stl_import(filepath=mesh_path)

                obj = bpy.context.active_object
                stats = mesh_stats(obj) if obj else "N/A"
                props.status_message = f"3D imported ({stats}). Run cleanup next."
            except Exception as e:
                props.status_message = f"Import error: {str(e)[:80]}"

            props.is_processing = False
            props.progress_percent = 100
            redraw_ui()
            return None

        bpy.app.timers.register(_import_mesh, first_interval=0.0)


class NB3DP_OT_ResumePolling(bpy.types.Operator):
    bl_idname = "nb3dp.resume_polling"
    bl_label = "Resume Polling"
    bl_description = "Resume polling fal.ai for a 3D generation that timed out"

    def execute(self, context):
        props = get_props()
        prefs = get_prefs()

        if not props.last_request_id:
            self.report({'ERROR'}, "No pending request to resume")
            return {'CANCELLED'}

        api_key = prefs.fal_api_key
        if not api_key:
            self.report({'ERROR'}, "Please set your fal.ai API key in addon preferences")
            return {'CANCELLED'}

        props.is_processing = True
        props.progress_percent = 0
        props.status_message = f"Resuming poll for {props.last_request_id[:16]}..."

        thread = threading.Thread(
            target=NB3DP_OT_Generate3D._resume_3d,
            args=(props.last_request_id, api_key),
            daemon=True
        )
        thread.start()
        return {'FINISHED'}


# =============================================================================
# OPERATORS — CLEANUP
# =============================================================================

class NB3DP_OT_AutoCleanup(bpy.types.Operator):
    bl_idname = "nb3dp.auto_cleanup"
    bl_label = "Auto Cleanup for Print"
    bl_description = "Run automated cleanup pipeline based on selected print technology"

    def execute(self, context):
        props = get_props()
        obj = context.active_object

        if not obj or obj.type != 'MESH':
            self.report({'ERROR'}, "Select a mesh object first")
            return {'CANCELLED'}

        props.status_message = "Running cleanup..."

        # ---- Phase 1: Geometry repair ----
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')

        # Remove doubles with tight threshold
        bpy.ops.mesh.remove_doubles(threshold=0.0001)

        # Fix normals
        bpy.ops.mesh.normals_make_consistent(inside=False)

        # Remove loose geometry
        bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)

        bpy.ops.object.mode_set(mode='OBJECT')

        before_stats = mesh_stats(obj)

        # ---- Phase 2: Decimate if needed ----
        face_count = len(obj.data.polygons)
        if face_count > 150000:
            target_faces = 100000
            ratio = target_faces / face_count
            mod = obj.modifiers.new(name="Decimate_Print", type='DECIMATE')
            mod.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)

        # ---- Phase 3: Flatten base ----
        self._flatten_base(obj)

        # ---- Phase 4: Scale by longest dimension ----
        longest = max(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z)
        if longest > 0:
            target_m = props.target_size_mm / 1000.0
            scale_factor = target_m / longest
            obj.scale *= scale_factor
            bpy.ops.object.transform_apply(scale=True)

        # ---- Phase 5: Technology-specific cleanup ----
        if props.print_tech == "FDM":
            self._cleanup_fdm(context, obj, props)
        elif props.print_tech == "RESIN":
            self._cleanup_resin(context, obj, props)
        elif props.print_tech == "SLS":
            self._cleanup_sls(context, obj, props)

        after_stats = mesh_stats(obj)
        dims = obj.dimensions
        dims_mm = f"{dims.x * 1000:.1f} x {dims.y * 1000:.1f} x {dims.z * 1000:.1f} mm"
        props.status_message = f"Cleanup done ({props.print_tech}). {after_stats}. {dims_mm}"
        self.report({'INFO'}, f"Before: {before_stats} | After: {after_stats} | Size: {dims_mm}")
        return {'FINISHED'}

    def _flatten_base(self, obj):
        """Push all vertices within 5mm of the bottom to the minimum Z."""
        mesh = obj.data
        if not mesh.vertices:
            return

        # Find min Z in local coords
        min_z = min(v.co.z for v in mesh.vertices)
        # 5mm threshold in object scale (Blender units ~ meters for normalized Hunyuan output)
        # Hunyuan outputs normalized ~1m models, so 5mm = 0.005m
        # But we haven't scaled yet at this point — we scale after flatten.
        # Use a fraction of the object height instead: bottom 5% of height
        z_range = max(v.co.z for v in mesh.vertices) - min_z
        threshold = min_z + z_range * 0.05  # bottom 5%

        for v in mesh.vertices:
            if v.co.z <= threshold:
                v.co.z = min_z

        mesh.update()

    def _cleanup_fdm(self, context, obj, props):
        """FDM-specific: add base, edge split for layer adhesion."""
        if props.add_base:
            self._add_base(context, obj, props)

        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.faces_shade_smooth()
        bpy.ops.object.mode_set(mode='OBJECT')

        mod = obj.modifiers.new(name="EdgeSplit", type='EDGE_SPLIT')
        mod.split_angle = 0.523599  # 30 degrees

    def _cleanup_resin(self, context, obj, props):
        """Resin-specific: hollow model, add drain holes."""
        if props.add_base:
            self._add_base(context, obj, props)

        if props.hollow_model:
            wall_m = props.wall_thickness_mm / 1000.0
            mod = obj.modifiers.new(name="Solidify_Hollow", type='SOLIDIFY')
            mod.thickness = -wall_m
            mod.offset = -1
            mod.use_even_offset = True

    def _cleanup_sls(self, context, obj, props):
        """SLS-specific: minimal cleanup, no supports needed."""
        if props.add_base:
            self._add_base(context, obj, props)

    def _add_base(self, context, obj, props):
        """Add a flat rectangular base under the object matching its footprint."""
        base_height_m = props.base_thickness_mm / 1000.0
        dims = obj.dimensions
        margin = 0.002  # 2mm margin on each side

        # Rectangular base matching footprint
        base_x = dims.x + margin * 2
        base_y = dims.y + margin * 2

        base_loc = (
            obj.location.x,
            obj.location.y,
            obj.location.z - dims.z / 2 - base_height_m / 2
        )

        bpy.ops.mesh.primitive_cube_add(
            size=1.0,
            location=base_loc,
        )
        base_obj = context.active_object
        base_obj.name = f"{obj.name}_Base"
        base_obj.scale = (base_x, base_y, base_height_m)
        bpy.ops.object.transform_apply(scale=True)

        # Join with main object
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        base_obj.select_set(True)
        context.view_layer.objects.active = obj
        bpy.ops.object.join()


# =============================================================================
# OPERATORS — EXPORT
# =============================================================================

class NB3DP_OT_ExportSTL(bpy.types.Operator):
    bl_idname = "nb3dp.export_stl"
    bl_label = "Export Print-Ready STL"
    bl_description = "Apply all modifiers and export as STL"

    def execute(self, context):
        props = get_props()
        obj = context.active_object

        if not obj or obj.type != 'MESH':
            self.report({'ERROR'}, "Select a mesh object first")
            return {'CANCELLED'}

        for mod in obj.modifiers:
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except:
                pass

        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

        export_dir = bpy.path.abspath(props.export_path)
        if not os.path.isdir(export_dir):
            export_dir = tempfile.mkdtemp(prefix="nb3dp_export_")

        filename = f"{obj.name}_print_ready.stl"
        filepath = os.path.join(export_dir, filename)

        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)

        bpy.ops.wm.stl_export(
            filepath=filepath,
            export_selected_objects=True,
            apply_modifiers=True,
        )

        dims = obj.dimensions
        dims_mm = f"{dims.x * 1000:.1f} x {dims.y * 1000:.1f} x {dims.z * 1000:.1f} mm"
        stats = mesh_stats(obj)
        props.status_message = f"Exported: {filename} ({stats}, {dims_mm})"
        self.report({'INFO'}, f"STL exported to {filepath}")
        return {'FINISHED'}


class NB3DP_OT_QuickExport(bpy.types.Operator):
    bl_idname = "nb3dp.quick_export"
    bl_label = "Quick Export (Desktop)"
    bl_description = "Apply modifiers and export STL to Desktop"

    def execute(self, context):
        obj = context.active_object
        if not obj or obj.type != 'MESH':
            self.report({'ERROR'}, "Select a mesh object first")
            return {'CANCELLED'}

        for mod in obj.modifiers:
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except:
                pass

        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.isdir(desktop):
            desktop = os.path.expanduser("~")

        filepath = os.path.join(desktop, f"{obj.name}_print_ready.stl")

        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.ops.wm.stl_export(
            filepath=filepath,
            export_selected_objects=True,
            apply_modifiers=True,
        )

        dims = obj.dimensions
        dims_mm = f"{dims.x * 1000:.1f} x {dims.y * 1000:.1f} x {dims.z * 1000:.1f} mm"
        stats = mesh_stats(obj)
        props = get_props()
        props.status_message = f"Exported to Desktop! ({stats}, {dims_mm})"
        self.report({'INFO'}, f"STL exported to {filepath}")
        return {'FINISHED'}


# =============================================================================
# PANELS
# =============================================================================

class NB3DP_PT_MainPanel(bpy.types.Panel):
    bl_label = "idea2real by NotJustPrompts"
    bl_idname = "NB3DP_PT_main"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "idea2real"

    def draw(self, context):
        layout = self.layout
        props = get_props()

        # API key check
        prefs = get_prefs()
        if not prefs.fal_api_key:
            warn_box = layout.box()
            warn_box.label(text="fal.ai API key not set", icon='ERROR')
            warn_box.label(text="Edit > Preferences > Add-ons > idea2real")
            warn_box.operator("nb3dp.open_preferences", text="Open Preferences", icon='PREFERENCES')

        # Status bar
        status_box = layout.box()
        row = status_box.row()
        if props.is_processing:
            row.label(text=props.status_message, icon='SORTTIME')
            if props.progress_percent > 0:
                status_box.prop(props, "progress_percent", text="Progress", slider=True)
        else:
            row.label(text=props.status_message, icon='INFO')

        # Active object stats
        obj = context.active_object
        if obj and obj.type == 'MESH':
            stats_row = status_box.row()
            stats_row.label(text=f"Selected: {obj.name} ({mesh_stats(obj)})", icon='MESH_DATA')


class NB3DP_PT_InputImagePanel(bpy.types.Panel):
    bl_label = "① Input Image"
    bl_idname = "NB3DP_PT_inputimage"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "idea2real"
    bl_parent_id = "NB3DP_PT_main"

    def draw(self, context):
        layout = self.layout
        props = get_props()

        box = layout.box()
        box.label(text="Upload a reference image:", icon='IMAGE_DATA')
        box.prop(props, "input_image_path", text="")

        # Show which image will be used + preview
        upload_path = props.input_image_path
        generated_path = props.generated_image_path
        if upload_path and os.path.exists(bpy.path.abspath(upload_path)):
            box.label(text=f"Ready: {os.path.basename(upload_path)}", icon='CHECKMARK')
            img = bpy.data.images.get("NB3DP_Upload_Preview")
            if img and img.preview and img.preview.icon_id:
                box.template_icon(icon_value=img.preview.icon_id, scale=14.0)
        elif generated_path and os.path.exists(bpy.path.abspath(generated_path)):
            box.label(text=f"Using generated: {os.path.basename(generated_path)}", icon='CHECKMARK')
            if "NB3DP_Generated" in bpy.data.images:
                box.template_preview(bpy.data.images["NB3DP_Generated"])
        else:
            sub = box.column(align=True)
            sub.scale_y = 0.7
            sub.label(text="...or generate one below", icon='DOWNARROW_HLT')


class NB3DP_PT_ImageGenPanel(bpy.types.Panel):
    bl_label = "Generate Input Image (Optional)"
    bl_idname = "NB3DP_PT_imagegen"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "idea2real"
    bl_parent_id = "NB3DP_PT_inputimage"
    bl_options = {'DEFAULT_CLOSED'}

    def draw(self, context):
        layout = self.layout
        props = get_props()
        processing = props.is_processing

        layout.label(text="Use Nano Banana to create an input image from text.")

        layout.prop(props, "nano_model")
        layout.prop(props, "aspect_ratio")

        # Prompt — type directly or load from file
        layout.label(text="Prompt:")
        row = layout.row(align=True)
        row.scale_y = 2.0
        row.prop(props, "prompt", text="")

        row = layout.row(align=True)
        row.operator("nb3dp.load_prompt_file", text="Load from File", icon='FILE_TEXT')

        # Show preview of loaded prompt if it's long
        if props.prompt and len(props.prompt) > 80:
            preview_box = layout.box()
            col = preview_box.column(align=True)
            col.scale_y = 0.7
            # Show first ~3 lines worth of text
            prompt_text = props.prompt
            for i in range(0, min(len(prompt_text), 240), 80):
                chunk = prompt_text[i:i+80]
                if chunk:
                    col.label(text=chunk)
            if len(prompt_text) > 240:
                col.label(text=f"... ({len(prompt_text)} chars total)")

        # Reference images
        box = layout.box()
        row = box.row()
        row.label(text=f"Reference Images ({len(props.reference_images)}/14)", icon='IMAGE_DATA')
        sub = row.row(align=True)
        sub.enabled = not processing
        sub.operator("nb3dp.add_reference_image", text="", icon='ADD')
        sub.operator("nb3dp.clear_reference_images", text="", icon='TRASH')

        if props.reference_images:
            pcoll = _get_ref_preview_collection()
            # Show thumbnails in rows (4 per row)
            cols_per_row = 4
            for row_start in range(0, len(props.reference_images), cols_per_row):
                row = box.row(align=True)
                for i in range(row_start, min(row_start + cols_per_row, len(props.reference_images))):
                    ref = props.reference_images[i]
                    col = row.column(align=True)
                    key = f"ref_{i}"
                    if pcoll and key in pcoll:
                        col.template_icon(icon_value=pcoll[key].icon_id, scale=7.0)
                    else:
                        col.label(text=ref.name[:10] if ref.name else "?", icon='IMAGE')
                    op = col.operator("nb3dp.remove_reference_image", text="", icon='X')
                    op.index = i

        row = layout.row(align=True)
        row.scale_y = 1.5
        row.enabled = not processing
        row.operator("nb3dp.generate_image", text="Generate with Nano Banana", icon='RENDER_STILL')

        if props.generated_image_path:
            box = layout.box()
            box.label(text="Generated Image:", icon='CHECKMARK')
            if "NB3DP_Generated" in bpy.data.images:
                box.template_preview(bpy.data.images["NB3DP_Generated"])
            row = box.row()
            row.enabled = not processing
            row.operator("nb3dp.use_generated_image", text="Use as 3D Input", icon='FORWARD')


class NB3DP_PT_3DGenPanel(bpy.types.Panel):
    bl_label = "② Generate 3D Model"
    bl_idname = "NB3DP_PT_3dgen"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "idea2real"
    bl_parent_id = "NB3DP_PT_main"

    def draw(self, context):
        layout = self.layout
        props = get_props()
        processing = props.is_processing

        layout.label(text="Hunyuan3D v3 Settings:", icon='PREFERENCES')
        layout.prop(props, "face_count")
        layout.prop(props, "enable_pbr")

        row = layout.row()
        row.scale_y = 0.7
        row.label(text="Provider: fal.ai", icon='URL')

        # Generate 3D button
        row = layout.row(align=True)
        row.scale_y = 1.5
        row.enabled = not processing
        row.operator("nb3dp.generate_3d", text="Generate 3D with Hunyuan", icon='MESH_MONKEY')

        # Resume button — shown when a previous job timed out
        if props.last_request_id and not processing:
            box = layout.box()
            box.label(text="Previous job still running on fal.ai:", icon='TIME')
            col = box.column(align=True)
            col.scale_y = 0.7
            col.label(text=f"ID: {props.last_request_id[:24]}...")
            row = box.row(align=True)
            row.scale_y = 1.3
            row.operator("nb3dp.resume_polling", text="Resume Polling", icon='FILE_REFRESH')


class NB3DP_PT_CleanupPanel(bpy.types.Panel):
    bl_label = "③ Print Cleanup"
    bl_idname = "NB3DP_PT_cleanup"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "idea2real"
    bl_parent_id = "NB3DP_PT_main"

    def draw(self, context):
        layout = self.layout
        props = get_props()

        layout.prop(props, "print_tech")

        # Scale settings
        box = layout.box()
        box.label(text="Scale:", icon='ARROW_LEFTRIGHT')
        box.prop(props, "target_size_mm")
        box.label(text="Scales the longest axis to this size", icon='INFO')

        # Options
        box = layout.box()
        box.label(text="Options:", icon='PREFERENCES')
        box.prop(props, "add_base")
        if props.add_base:
            box.prop(props, "base_thickness_mm")

        if props.print_tech == "RESIN":
            box.prop(props, "hollow_model")
            if props.hollow_model:
                box.prop(props, "wall_thickness_mm")

        # Info about what cleanup does
        info_box = layout.box()
        info_box.label(text="Pipeline:", icon='SEQUENCE')
        col = info_box.column(align=True)
        col.scale_y = 0.8
        col.label(text="1. Merge doubles + fix normals")
        col.label(text="2. Decimate to ~100K faces (if needed)")
        col.label(text="3. Flatten base (bottom 5%)")
        col.label(text="4. Scale to target size")
        col.label(text="5. Tech-specific cleanup + base")

        # Cleanup button
        row = layout.row(align=True)
        row.scale_y = 1.5
        row.enabled = not props.is_processing
        row.operator("nb3dp.auto_cleanup", text="Run Auto Cleanup", icon='BRUSH_DATA')


class NB3DP_PT_ExportPanel(bpy.types.Panel):
    bl_label = "④ Export STL"
    bl_idname = "NB3DP_PT_export"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "idea2real"
    bl_parent_id = "NB3DP_PT_main"

    def draw(self, context):
        layout = self.layout
        props = get_props()
        processing = props.is_processing

        layout.prop(props, "export_path")

        row = layout.row(align=True)
        row.scale_y = 1.5
        row.enabled = not processing
        row.operator("nb3dp.export_stl", text="Export STL", icon='EXPORT')

        layout.separator()

        row = layout.row(align=True)
        row.scale_y = 1.3
        row.enabled = not processing
        row.operator("nb3dp.quick_export", text="Quick Export to Desktop", icon='FILE_FOLDER')


# =============================================================================
# OPERATORS — UTILITIES
# =============================================================================

class NB3DP_OT_OpenPreferences(bpy.types.Operator):
    bl_idname = "nb3dp.open_preferences"
    bl_label = "Open idea2real Preferences"
    bl_description = "Open addon preferences to set your API key"

    def execute(self, context):
        bpy.ops.screen.userpref_show()
        bpy.context.preferences.active_section = 'ADDONS'
        return {'FINISHED'}


# =============================================================================
# PREFERENCES (API Key)
# =============================================================================

class NB3DP_Preferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    fal_api_key: StringProperty(
        name="fal.ai API Key",
        description="Your fal.ai API key (get from fal.ai/dashboard/keys)",
        subtype='PASSWORD',
    )

    def draw(self, context):
        layout = self.layout
        layout.label(text="API Key (stored locally in Blender preferences)", icon='LOCKED')
        layout.prop(self, "fal_api_key")
        layout.separator()
        layout.label(text="Get your key from: fal.ai/dashboard/keys", icon='URL')


# =============================================================================
# REGISTRATION
# =============================================================================

classes = [
    NB3DP_ReferenceImage,
    NB3DP_Properties,
    NB3DP_Preferences,
    NB3DP_OT_AddReferenceImage,
    NB3DP_OT_RemoveReferenceImage,
    NB3DP_OT_ClearReferenceImages,
    NB3DP_OT_LoadPromptFile,
    NB3DP_OT_GenerateImage,
    NB3DP_OT_UseGeneratedImage,
    NB3DP_OT_Generate3D,
    NB3DP_OT_ResumePolling,
    NB3DP_OT_AutoCleanup,
    NB3DP_OT_ExportSTL,
    NB3DP_OT_QuickExport,
    NB3DP_OT_OpenPreferences,
    NB3DP_PT_MainPanel,
    NB3DP_PT_InputImagePanel,
    NB3DP_PT_ImageGenPanel,
    NB3DP_PT_3DGenPanel,
    NB3DP_PT_CleanupPanel,
    NB3DP_PT_ExportPanel,
]


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.nb3dp = PointerProperty(type=NB3DP_Properties)
    bpy.types.Scene.nb3dp_ref_previews = bpy.utils.previews.new()


def unregister():
    pcoll = getattr(bpy.types.Scene, "nb3dp_ref_previews", None)
    if pcoll is not None:
        bpy.utils.previews.remove(pcoll)
        del bpy.types.Scene.nb3dp_ref_previews
    del bpy.types.Scene.nb3dp
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
