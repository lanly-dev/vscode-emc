# Change Log

All notable changes to the "Easy Media Converter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com) for recommendations on how to structure this file.

## [Future Works]
- Patch processing
- Show media information
- GPU option
- Time estimation
- Integrate with Spectrogram extension

## [1.0.0] - March 2023
- Add support `ape | flac | ts | wav`
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
