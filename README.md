# Easy Media Converter
Have you ever wondered 🤔 if VS Code could become a media converter for some reason?\
Or maybe you have stumbled upon the need to quickly convert a media file for your game development?\
Or perhaps you need a WAV format audio file for a voice training project?
The answer is **YES❗**

This is the extension that could help you with that job, and right inside the VS Code. How 😎🆒🧊!\
It converts supported image, audio, and video formats, using *ffmpeg*, here and there 🎉.

<img src='https://github.com/lanly-dev/vscode-emc/blob/main/media/vscodeignore/emc.gif?raw=true' width='450'/>

## Features
- For image: `jpg|jpeg|png|webp` --> Convert to `jpg`
- For audio: `ape|flac|mp3|wav|wma` --> Convert to `mp3|wav`
- For video: `avi|flv|mkv|mp4|ts|webm|wmv` --> Convert to `mp4`
- Batch conversion

- Other use cases:
  - Extract audio from video by converting it to an audio format
  - Converting to the same format to reduce its size (and quality, as reducing size often results in quality loss) in some cases if you want a smaller size, if it increases the file size - just stick with the original

> Note: All conversion settings use the default configuration of ffmpeg except for `mp3cd` options in batch conversion

## Release Notes
### 2.0.0
- Add treeview/queue for batch conversion
- Add time estimation for single converting

### 1.1.0
- Add support for image conversion: `jpg|jpeg|png|webp`
- Add `webm` for video conversion
- Add GPU `h264_nvenc` option for faster video encoding using Nvidia GPUs

### 1.0.0
- Add support `ape|flac|wav|ts`
- Add cancellable button

### 0.1.0
- Use local binary instead Google Cloud Functions

### 0.0.1
- Initial release of Easy Media Converter

**Enjoy!**
