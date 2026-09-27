import random

import spaces
import torch
import gradio as gr
from diffusers import QwenImage21Pipeline
from PIL import Image


MODEL_ID = "Qwen/Qwen-Image-2.1"
ASPECT_RATIOS = {
    "1:1": (1024, 1024),
    "4:3": (1152, 864),
    "3:4": (864, 1152),
    "3:2": (1216, 816),
    "2:3": (816, 1216),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
}

# ZeroGPU expects the pipeline to be initialized once at module scope.
pipe = QwenImage21Pipeline.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
).to("cuda")


def _dimensions(aspect_ratio: str, resolution: str) -> tuple[int, int]:
    base_width, base_height = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS["1:1"])
    if resolution == "2048":
        scale = 2
        return base_width * scale, base_height * scale
    return base_width, base_height


@spaces.GPU(duration=180)
def generate(
    prompt: str,
    reference_image: Image.Image | None = None,
    aspect_ratio: str = "1:1",
    resolution: str = "1024",
    steps: int = 28,
    seed: int = -1,
    transparent: bool = False,
) -> Image.Image:
    """Generate a Qwen-Image-2.1 image from a prompt, with optional image editing."""
    prompt = (prompt or "").strip()
    if not prompt:
        raise gr.Error("Please enter a prompt.")

    if transparent and "transparent" not in prompt.lower():
        prompt = (
            f"{prompt}. This is an RGBA image with transparency. "
            "Keep the background transparent."
        )

    width, height = _dimensions(aspect_ratio, resolution)
    safe_steps = max(8, min(int(steps), 50))
    chosen_seed = random.randint(0, 2**31 - 1) if int(seed) < 0 else int(seed)
    generator = torch.Generator(device="cuda").manual_seed(chosen_seed)

    pipeline_args = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": safe_steps,
        "generator": generator,
    }
    if reference_image is not None:
        pipeline_args["image"] = reference_image.convert("RGB")

    return pipe(**pipeline_args).images[0]


CSS = """
#page {
    max-width: 1180px;
    margin: 0 auto;
}
.hero {
    padding: 1.25rem 1.4rem;
    border: 1px solid rgba(125, 95, 255, 0.25);
    border-radius: 1.25rem;
    background: linear-gradient(135deg, rgba(125, 95, 255, 0.16), rgba(20, 24, 45, 0.04));
}
.hint {
    color: var(--body-text-color-subdued);
}
"""


with gr.Blocks(
    theme=gr.themes.Citrus(),
    css=CSS,
    title="Qwen-Image 2.1 Demo",
) as demo:
    with gr.Column(elem_id="page"):
        gr.HTML(
            """
            <div class="hero">
              <h1>Qwen-Image 2.1</h1>
              <p class="hint">
                Text-to-image and image editing with native transparent output.
                Upload a reference image to edit it, or leave it empty for text-to-image.
              </p>
            </div>
            """
        )

        with gr.Row():
            with gr.Column(scale=1):
                prompt = gr.Textbox(
                    label="Prompt",
                    placeholder="A cinematic Persian miniature of a futuristic city at sunrise…",
                    lines=5,
                )
                reference_image = gr.Image(
                    label="Reference image (optional)",
                    type="pil",
                    sources=["upload", "clipboard"],
                )
                with gr.Row():
                    aspect_ratio = gr.Dropdown(
                        choices=list(ASPECT_RATIOS),
                        value="1:1",
                        label="Aspect ratio",
                    )
                    resolution = gr.Dropdown(
                        choices=["1024", "2048"],
                        value="1024",
                        label="Resolution",
                    )
                with gr.Row():
                    steps = gr.Slider(
                        minimum=8,
                        maximum=50,
                        value=28,
                        step=1,
                        label="Inference steps",
                    )
                    seed = gr.Number(value=-1, precision=0, label="Seed (-1 = random)")
                transparent = gr.Checkbox(
                    label="Request a transparent RGBA background",
                    value=False,
                )
                generate_button = gr.Button("Generate image", variant="primary")

            with gr.Column(scale=1):
                output = gr.Image(
                    label="Generated image",
                    type="pil",
                    format="png",
                    show_download_button=True,
                )

        generate_button.click(
            fn=generate,
            inputs=[
                prompt,
                reference_image,
                aspect_ratio,
                resolution,
                steps,
                seed,
                transparent,
            ],
            outputs=output,
            api_name="generate",
        )
        gr.Examples(
            examples=[
                ["A neon Persian sign reading QWEN IMAGE 2.1 in a rainy night market"],
                ["A small red fox made of folded paper, studio lighting, detailed texture"],
                ["A brutalist library floating above the clouds, golden-hour photography"],
            ],
            inputs=[prompt],
            outputs=output,
            fn=generate,
            cache_examples=True,
            cache_mode="lazy",
        )
        gr.Markdown(
            """
            **Model:** [Qwen/Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1)  
            **Tip:** The first generation may take longer while the model is loaded on ZeroGPU.
            """
        )


if __name__ == "__main__":
    demo.launch(mcp_server=True)