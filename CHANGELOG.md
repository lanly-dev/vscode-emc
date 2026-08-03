# Change Log
All notable changes to the "Easy Media Converter" extension will be documented in this file.\
Check [Keep a Changelog](http://keepachangelog.com) for recommendations on how to structure this file.

## [Future Works]
- 1st/last picture extraction
- Connect to spectrogram
- Crop/merging feature
- Divide into equal duration
- Drag and drop to queue
- FileChooser for queue
- Generate sub
- Embed sub
- Generate text - connect to lemonade
- Integrate with Spectrogram extension
- Progress percentage
- Short video format conversion
- Show media information
- Time estimation for batch conversion

## [3.0.0] - August 2026
- Improve Treeview and add settings in it
- New activity-bar/explorer icon
- Custom quality configuration for conversion
- Remove `mp3cd` conversion config
- Support GIF conversion
- Switch binary download from [eugeneware](https://github.com/eugeneware/ffmpeg-static) to [BtbN](https://github.com/BtbN/FFmpeg-Builds) with zip/tar extraction
- Using child process to call `ffmpeg` binary instead [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
- Publish to ovsx
- webpack 5.109.2 compiled successfully in 2912 ms
- 9 files, 181.04 KB, 1.131.0, req1.125.0
```txt
INFO  Files included in the VSIX:
easymediaconverter-3.0.0.vsix
├─ [Content_Types].xml
├─ extension.vsixmanifest
└─ extension/
   ├─ LICENSE.md [1.06 KB]
   ├─ changelog.md [4.01 KB]
   ├─ package.json [9.78 KB]
   ├─ readme.md [2 KB]
   ├─ dist/
   │  └─ extension.js [403.39 KB]
   └─ media/
      ├─ emc.png [66.22 KB]
      └─ emc.svg [6.77 KB]
```

## [2.0.0] - May 2025
- Add treeview - the main feature
  - Shows the queue and queue's info
  - Output conversion summary
  - Low-key has `mp3cd` option for my own CD use case
  - Has icon and badge \
    ![treeview](https://github.com/lanly-dev/vscode-emc/raw/main/media/vscodeignore/treeview.png)
- Add time estimation for single converting
- Fix Eslint configs
- webpack 5.99.9 compiled with 1 warning in 2135 ms
- 10 files, 144.58 KB, 1.100.0

## Notes
- `registerTreeDataProvider()` vs `createTreeView()`
  - `registerTreeDataProvider()` must be declared in `package.json`. It is for simple treeview, and it does not support badges or treeview methods and returns a `Disposable` object
  - `createTreeView()` dynamically creates a tree view at runtime, meaning it allows the creation of tree views without pre-declaration in `package.json`. It returns treeview instance
  - Hybrid solution: Declare the tree view in `package.json` but don't use `registerTreeDataProvider()`
## Reference
- https://code.visualstudio.com/api/extension-guides/tree-view

## [1.1.0] - March 2025
- Add image conversion feature: convert `jpg|jpeg|png|webp` to `jpg`
- Add `webm` support
- Enable GPU acceleration with the `h264-nvenc` option
- Add same type conversion - this sometime reduce the file size
- webpack 5.98.0 compiled with 1 warning in 2160 ms
- 9 files, 139.77 KB, 1.98

### Notes
- Wanted to support `svg` support feature, and there is no easy way to bundle it up
  - Converting from `svg` to `jpg`: bundling dependencies failed
  - Converting from `jpg` or other formats to `svg`: works well for small images but takes a really long time for large images

## [1.0.0] - March 2025
- Add support `ape|flac|ts|wav`
- Add cancellable button
- ffmpeg 6.0
- webpack 5.98.0 compiled with 1 warning in 5570 ms
- 9 files, 138.96 KB, 1.97.0

## [0.1.0] - March 2022
- Use local ffmpeg binary for conversion
- ffmpeg 5.0
- webpack 5.70.0 compiled with 1 warning in 5687 ms
- 8 files, 101.1KB, 1.65.0

### Notes
- The `progress` and `codeData` events don't fire/emit after the first run (potential `fluent-ffmpeg` package bug)

## [0.0.1] - February 2022
- Initial release
- webpack 5.68.0 compiled with 3 warnings in 15580 ms
- 11 files, 1.68MB, 1.64.0

### Notes
- Using *ffmpeg* that deployed on Google Cloud Functions for the hackathon requirement - Google Cloud | Easy as Pie Hackathon
