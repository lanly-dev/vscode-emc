# Easy Media Converter 🍰
Have you ever wondered 🤔 if VS Code could become a media converter for some reason?\
Or maybe you have stumbled upon the need to quickly convert a media file for your game development?\
Or perhaps you need a WAV format audio file for a voice training project?\
The answer is **YES!**
<a href="https://marketplace.visualstudio.com/items?itemName=	lanly-dev.easymediaconverter" target="_blank">
  <img src='https://code.visualstudio.com/favicon.ico' width='12'/>
</a>
<a href="https://open-vsx.org/extension/lanly-dev/easymediaconverter" target="_blank">
  <img src='https://open-vsx.org/favicon.ico' width='11'/>
</a>


This is the extension that could help you with that job, and right inside the VS Code. How 😎🆒🧊!\
It converts supported image, audio, and video formats, using *ffmpeg*, here and there 🎉.

<img src='https://github.com/lanly-dev/vscode-emc/blob/main/media/vscodeignore/emc.gif?raw=true' width='450'/>

## Features
- For image: `jpg|jpeg|png|webp` --> `jpg`
- For audio: `ape|flac|mp3|wav|wma` --> `mp3|wav`
- For video: `avi|flv|mkv|mp4|ts|webm|wmv` --> `mp4`
- For gif:
  - `gif` --> `gif` only 1st frame
  - `gif` --> `jpg` only 1st frame
  - `gif` --> `mp4` will fail if not multi-frames
  - `jpg|avi|flv|mkv|mp4|ts|webm|wmv` --> `gif`
- Batch/Queue conversion

- Other use cases:
  - Extract audio from video by converting it to an audio format

## Release Notes
### 3.0.0
- Add settings to treeview
- Add Custom quality configuration
- Add Support `gif` conversion

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
