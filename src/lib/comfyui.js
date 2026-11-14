export const DEFAULT_NEGATIVE_PROMPT =
  'blurry, low quality, distorted, bad anatomy, bad hands, text, watermark, logo, duplicate, cropped, ugly'

export const COMFY_WORKFLOWS = {
  sd15_frames: 'SD1.5 Frame Batch (stock ComfyUI)',
  animatediff: 'AnimateDiff SD1.5 (needs custom nodes)',
  wan21: 'Wan 2.1 T2V (native, needs Wan models)',
}

// Verbatim structure of the workflow the original app exported.
export function buildSd15FrameBatchWorkflow({
  prompt,
  negativePrompt = DEFAULT_NEGATIVE_PROMPT,
  seed = -1,
  steps = 20,
  cfg = 7.5,
  width = 768,
  height = 432,
  frames = 16,
  checkpoint = 'v1-5-pruned-emaonly.safetensors',
  fps = 12,
}) {
  return {
    prompt: {
      '3': {
        inputs: {
          seed: seed === -1 ? Math.floor(Math.random() * 1125899906842624) : seed,
          steps,
          cfg,
          sampler_name: 'euler_ancestral',
          scheduler: 'karras',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
        class_type: 'KSampler',
        _meta: { title: 'KSampler' },
      },
      '4': {
        inputs: { ckpt_name: checkpoint },
        class_type: 'CheckpointLoaderSimple',
        _meta: { title: 'Load Checkpoint' },
      },
      '5': {
        inputs: { width, height, batch_size: frames },
        class_type: 'EmptyLatentImage',
        _meta: { title: 'Empty Latent Image' },
      },
      '6': {
        inputs: { text: prompt, clip: ['4', 1] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'Positive Prompt' },
      },
      '7': {
        inputs: { text: negativePrompt, clip: ['4', 1] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'Negative Prompt' },
      },
      '8': {
        inputs: { samples: ['3', 0], vae: ['4', 2] },
        class_type: 'VAEDecode',
        _meta: { title: 'VAE Decode' },
      },
      '9': {
        inputs: { filename_prefix: 'AI_Music_Video_ComfyUI', fps, images: ['8', 0] },
        class_type: 'SaveImage',
        _meta: { title: 'Save Image' },
      },
    },
  }
}

// Requires: https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved
//           https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
// Motion model in ComfyUI/models/animatediff_models/ e.g. mm_sd_v15_v2.ckpt
export function buildAnimateDiffWorkflow({
  prompt,
  negativePrompt = DEFAULT_NEGATIVE_PROMPT,
  seed = -1,
  steps = 20,
  cfg = 7.5,
  width = 768,
  height = 432,
  frames = 16,
  checkpoint = 'v1-5-pruned-emaonly.safetensors',
  motionModel = 'mm_sd_v15_v2.ckpt',
  fps = 12,
  format = 'video/h264-mp4',
}) {
  return {
    prompt: {
      '1': {
        inputs: { ckpt_name: checkpoint },
        class_type: 'CheckpointLoaderSimple',
        _meta: { title: 'Load Checkpoint' },
      },
      '2': {
        inputs: {
          model_name: motionModel,
          beta_schedule: 'autoselect',
          model: ['1', 0],
        },
        class_type: 'ADE_AnimateDiffLoaderGen1',
        _meta: { title: 'AnimateDiff Loader' },
      },
      '3': {
        inputs: {
          seed: seed === -1 ? Math.floor(Math.random() * 1125899906842624) : seed,
          steps,
          cfg,
          sampler_name: 'euler_ancestral',
          scheduler: 'karras',
          denoise: 1,
          model: ['2', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
        class_type: 'KSampler',
        _meta: { title: 'KSampler' },
      },
      '4': {
        inputs: { width, height, batch_size: frames },
        class_type: 'EmptyLatentImage',
        _meta: { title: 'Empty Latent (frames)' },
      },
      '5': {
        inputs: { length: frames, width, height, batch_size: 1 },
        class_type: 'ADE_EmptyLatentImageLarge',
        _meta: { title: 'AnimateDiff Latent' },
      },
      '6': {
        inputs: { text: prompt, clip: ['1', 1] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'Positive Prompt' },
      },
      '7': {
        inputs: { text: negativePrompt, clip: ['1', 1] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'Negative Prompt' },
      },
      '8': {
        inputs: { samples: ['3', 0], vae: ['1', 2] },
        class_type: 'VAEDecode',
        _meta: { title: 'VAE Decode' },
      },
      '9': {
        inputs: {
          images: ['8', 0],
          frame_rate: fps,
          loop_count: 0,
          filename_prefix: 'AI_MVD_AniDiff',
          format,
          pingpong: false,
          save_output: true,
        },
        class_type: 'VHS_VideoCombine',
        _meta: { title: 'Video Combine' },
      },
    },
  }
}

// Uses ComfyUI's native Wan 2.1 support (no custom nodes).
// Required files:
//   diffusion_models: wan2.1_t2v_1.3B_fp16.safetensors -> models/diffusion_models (or unet)
//   text encoder:     umt5_xxl_fp8_e4m3fn_scaled.safetensors -> models/text_encoders (or clip)
//   vae:              wan_2.1_vae.safetensors -> models/vae
export function buildWan21Workflow({
  prompt,
  negativePrompt = DEFAULT_NEGATIVE_PROMPT,
  seed = -1,
  steps = 20,
  cfg = 6,
  width = 832,
  height = 480,
  frames = 81,
  fps = 16,
  unetName = 'wan2.1_t2v_1.3B_fp16.safetensors',
  clipName = 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
  vaeName = 'wan_2.1_vae.safetensors',
  shift = 8,
}) {
  return {
    prompt: {
      '1': {
        inputs: { unet_name: unetName, weight_dtype: 'default' },
        class_type: 'UNETLoader',
        _meta: { title: 'Load Wan UNET' },
      },
      '2': {
        inputs: { clip_name: clipName, type: 'wan' },
        class_type: 'CLIPLoader',
        _meta: { title: 'Load UMT5 Encoder' },
      },
      '3': {
        inputs: { vae_name: vaeName },
        class_type: 'VAELoader',
        _meta: { title: 'Load Wan VAE' },
      },
      '4': {
        inputs: { text: prompt, clip: ['2', 0] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'Positive Prompt' },
      },
      '5': {
        inputs: { text: negativePrompt, clip: ['2', 0] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'Negative Prompt' },
      },
      '6': {
        inputs: { model: ['1', 0], shift },
        class_type: 'ModelSamplingSD3',
        _meta: { title: 'Model Sampling SD3' },
      },
      '7': {
        inputs: { width, height, length: frames, batch_size: 1 },
        class_type: 'EmptyHunyuanLatentVideo',
        _meta: { title: 'Empty Video Latent' },
      },
      '8': {
        inputs: {
          seed: seed === -1 ? Math.floor(Math.random() * 1125899906842624) : seed,
          steps,
          cfg,
          sampler_name: 'euler',
          scheduler: 'simple',
          denoise: 1,
          model: ['6', 0],
          positive: ['4', 0],
          negative: ['5', 0],
          latent_image: ['7', 0],
        },
        class_type: 'KSampler',
        _meta: { title: 'KSampler' },
      },
      '9': {
        inputs: { samples: ['8', 0], vae: ['3', 0] },
        class_type: 'VAEDecode',
        _meta: { title: 'VAE Decode' },
      },
      '10': {
        inputs: {
          images: ['9', 0],
          frame_rate: fps,
          loop_count: 0,
          filename_prefix: 'AI_MVD_Wan21',
          format: 'video/h264-mp4',
          pingpong: false,
          save_output: true,
        },
        class_type: 'VHS_VideoCombine',
        _meta: { title: 'Video Combine' },
      },
    },
  }
}

export function buildWorkflow(workflowType, options) {
  switch (workflowType) {
    case 'animatediff':
      return buildAnimateDiffWorkflow(options)
    case 'wan21':
      return buildWan21Workflow(options)
    case 'sd15_frames':
    default:
      return buildSd15FrameBatchWorkflow(options)
  }
}

export async function pingComfy(endpoint) {
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/system_stats`, {
    method: 'GET',
  })
  if (!res.ok) throw new Error(`ComfyUI responded ${res.status}`)
  return res.json()
}

export async function queueComfyPrompt(endpoint, workflow) {
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || data.error || `Queue failed (${res.status})`)
  }
  return data // { prompt_id }
}

export async function getComfyHistory(endpoint, promptId) {
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/history/${promptId}`)
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`)
  return res.json()
}

export async function interruptComfy(endpoint) {
  await fetch(`${endpoint.replace(/\/$/, '')}/interrupt`, { method: 'POST' })
}

export function pollComfyJob(endpoint, promptId, { intervalMs = 2000, timeoutMs = 600000, onPoll = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    let attempt = 0
    const timer = setInterval(async () => {
      attempt++
      onPoll(attempt)
      try {
        const history = await getComfyHistory(endpoint, promptId)
        const entry = history[promptId]
        if (entry) {
          clearInterval(timer)
          if (entry.status?.status_str === 'error') {
            reject(new Error(entry.status?.messages?.join('; ') || 'ComfyUI job error'))
          } else {
            resolve(entry)
          }
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer)
          reject(new Error('Timed out waiting for ComfyUI job'))
        }
      } catch (err) {
        if (Date.now() - started > timeoutMs) {
          clearInterval(timer)
          reject(err)
        }
      }
    }, intervalMs)
  })
}

export function extractOutputs(historyEntry) {
  const outputs = []
  const out = historyEntry?.outputs || {}
  for (const nodeId of Object.keys(out)) {
    const nodeOut = out[nodeId]
    if (nodeOut.images) {
      for (const img of nodeOut.images) outputs.push(img)
    }
    if (nodeOut.gifs) {
      for (const g of nodeOut.gifs) outputs.push(g)
    }
    if (nodeOut.videos) {
      for (const v of nodeOut.videos) outputs.push(v)
    }
  }
  return outputs
}

export function comfyViewUrl(endpoint, item) {
  const params = new URLSearchParams({
    filename: item.filename,
    subfolder: item.subfolder || '',
    type: item.type || 'output',
  })
  return `${endpoint.replace(/\/$/, '')}/view?${params.toString()}`
}
