import * as THREE from 'three';
import type { TextureMemoryEstimate } from './MemoryTypes';

export function estimateTextureMemory(texture: THREE.Texture): TextureMemoryEstimate {
  const image = texture.image as TextureImageLike | undefined;
  const width = resolveImageDimension(image, 'width');
  const height = resolveImageDimension(image, 'height');
  const isCompressed = Boolean(
    (texture as THREE.Texture & { isCompressedTexture?: boolean }).isCompressedTexture,
  );
  const bytesPerPixel = isCompressed ? null : resolveBytesPerPixel(texture.format, texture.type);
  const mipmapMultiplier = texture.generateMipmaps ? 4 / 3 : 1;
  const notes: string[] = [];
  let estimatedBytes: number | null = null;

  if (isCompressed) {
    notes.push('Compressed texture byte size cannot be inferred exactly from Texture metadata.');
  }
  if (width === null || height === null) {
    notes.push('Texture source dimensions are unavailable.');
  }
  if (bytesPerPixel === null && !isCompressed) {
    notes.push('Texture format/type byte size is unknown.');
  }

  if (width !== null && height !== null && bytesPerPixel !== null) {
    estimatedBytes = Math.ceil(width * height * bytesPerPixel * mipmapMultiplier);
  }

  return {
    bytesPerPixel,
    confidence: estimatedBytes === null ? 'unknown' : 'estimated',
    estimatedBytes,
    format: formatConstantName(texture.format),
    height,
    id: texture.uuid,
    isCompressed,
    kind: 'texture',
    mipmapMultiplier,
    name: texture.name || texture.uuid,
    notes,
    type: typeConstantName(texture.type),
    width,
  };
}

export function estimateRenderTargetTextureMemory(
  renderTarget: THREE.WebGLRenderTarget,
): TextureMemoryEstimate {
  const estimate = estimateTextureMemory(renderTarget.texture);
  return {
    ...estimate,
    height: renderTarget.height,
    kind: 'renderTarget',
    name: renderTarget.texture.name || 'render-target',
    width: renderTarget.width,
  };
}

export function collectMaterialTextures(material: THREE.Material): THREE.Texture[] {
  const textures: THREE.Texture[] = [];
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) {
      textures.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof THREE.Texture) {
          textures.push(item);
        }
      }
    }
  }
  return textures;
}

export function resolveBytesPerPixel(
  format: THREE.AnyPixelFormat,
  type: THREE.TextureDataType,
): number | null {
  const channels = resolveChannelCount(format);
  const bytesPerChannel = resolveBytesPerChannel(type);

  if (channels === null || bytesPerChannel === null) {
    return null;
  }

  return channels * bytesPerChannel;
}

type TextureImageLike = {
  height?: number;
  naturalHeight?: number;
  naturalWidth?: number;
  videoHeight?: number;
  videoWidth?: number;
  width?: number;
};

function resolveImageDimension(
  image: TextureImageLike | undefined,
  key: 'height' | 'width',
): number | null {
  if (!image) {
    return null;
  }

  const candidates = key === 'width'
    ? [image.width, image.naturalWidth, image.videoWidth]
    : [image.height, image.naturalHeight, image.videoHeight];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }
  return null;
}

function resolveChannelCount(format: THREE.AnyPixelFormat): number | null {
  switch (format) {
    case THREE.AlphaFormat:
    case THREE.RedFormat:
    case THREE.RedIntegerFormat:
      return 1;
    case THREE.RGFormat:
    case THREE.RGIntegerFormat:
      return 2;
    case THREE.RGBFormat:
    case THREE.RGBIntegerFormat:
      return 3;
    case THREE.RGBAFormat:
    case THREE.RGBAIntegerFormat:
      return 4;
    default:
      return null;
  }
}

function resolveBytesPerChannel(type: THREE.TextureDataType): number | null {
  switch (type) {
    case THREE.UnsignedByteType:
    case THREE.ByteType:
      return 1;
    case THREE.UnsignedShortType:
    case THREE.ShortType:
    case THREE.HalfFloatType:
      return 2;
    case THREE.UnsignedIntType:
    case THREE.IntType:
    case THREE.FloatType:
      return 4;
    default:
      return null;
  }
}

function formatConstantName(format: THREE.AnyPixelFormat): string {
  const names = new Map<THREE.AnyPixelFormat, string>([
    [THREE.AlphaFormat, 'AlphaFormat'],
    [THREE.RedFormat, 'RedFormat'],
    [THREE.RedIntegerFormat, 'RedIntegerFormat'],
    [THREE.RGFormat, 'RGFormat'],
    [THREE.RGIntegerFormat, 'RGIntegerFormat'],
    [THREE.RGBFormat, 'RGBFormat'],
    [THREE.RGBIntegerFormat, 'RGBIntegerFormat'],
    [THREE.RGBAFormat, 'RGBAFormat'],
    [THREE.RGBAIntegerFormat, 'RGBAIntegerFormat'],
  ]);
  return names.get(format) ?? `UnknownFormat(${String(format)})`;
}

function typeConstantName(type: THREE.TextureDataType): string {
  const names = new Map<THREE.TextureDataType, string>([
    [THREE.ByteType, 'ByteType'],
    [THREE.FloatType, 'FloatType'],
    [THREE.HalfFloatType, 'HalfFloatType'],
    [THREE.IntType, 'IntType'],
    [THREE.ShortType, 'ShortType'],
    [THREE.UnsignedByteType, 'UnsignedByteType'],
    [THREE.UnsignedIntType, 'UnsignedIntType'],
    [THREE.UnsignedShortType, 'UnsignedShortType'],
  ]);
  return names.get(type) ?? `UnknownType(${String(type)})`;
}
