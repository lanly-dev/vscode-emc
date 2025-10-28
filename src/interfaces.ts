export enum MediaFileType {
  JPG = 'jpg',
  MP3 = 'mp3',
  MP3CD = 'mp3cd',
  MP4 = 'mp4',
  WAV = 'wav',
  WEBP = 'webp',
  WEBM = 'webm',
  GIF = 'gif'
}

export interface ConversionResult {
  input: string
  output: string
  time: number
  inputSize: number
  outputSize: number
}

export interface ConversionProgress {
  currentFps: number
  currentKbps: number
  timemark: string
}

export interface CodecData {
  duration: string
}
