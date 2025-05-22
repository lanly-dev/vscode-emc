# Change Log

All notable changes to the "Easy Media Converter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com) for recommendations on how to structure this file.

## [Future Works]
- Drag and drop to queue
- FileChooser for queue
- Integrate with Spectrogram extension
- Merging feature
- Show media information
- Time estimation for batch conversion
- Update/fix icon/logo

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
  - Hybrid solution: Declare the tree view in `package.json` but avoid using `registerTreeDataProvider()`
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
