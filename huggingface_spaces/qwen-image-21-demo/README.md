---
title: Qwen-Image 2.1 Demo
emoji: 🖼️
colorFrom: purple
colorTo: indigo
sdk: gradio
sdk_version: 6.28.0
app_file: app.py
short_description: Text-to-image and editing with Qwen-Image 2.1
python_version: "3.12"
startup_duration_timeout: 1h
---

# Qwen-Image 2.1 Demo

A Gradio demo for [Qwen/Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1).

The Space supports:

- Text-to-image generation
- Reference-image editing
- Multiple aspect ratios
- Reproducible seeds
- Native transparent RGBA image prompts

The model is loaded from the original Qwen repository and runs on Hugging Face ZeroGPU.

## License

The model is distributed under the Qwen Research License Agreement. Review the
[model license](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE)
before using generated outputs commercially.