import { performance as perf } from 'perf_hooks'
import { ProgressLocation, Uri, window } from 'vscode'

import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import { createCanvas, loadImage } from 'canvas'
import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'
import { extname } from 'path'
import pathToFfmpeg from 'ffmpeg-static'
import pb from 'pretty-bytes'

import { channel, fmtMSS, getOutFile, printToChannel, showPrintErrorMsg } from './utils'
import { MediaFileType } from './interfaces'

ffmpeg.setFfmpegPath(pathToFfmpeg!)
const { showInformationMessage } = window
const MSG = 'The ffmpeg binary is not found, please download it by running the `EMC: Download ffmpeg` command'

// Due to output format *** is not available
// https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1282
export default class Converter {

  static async convert({ fsPath, path }: Uri, type: MediaFileType) {
    channel.show()
    if (!fs.existsSync(pathToFfmpeg!)) {
      const abortMsg = 'Converting action aborted'
      showInformationMessage(MSG)
      showInformationMessage(abortMsg)
      printToChannel(MSG)
      printToChannel(abortMsg)
      return
    }
    try {
      const inputExtName = extname(path).toLowerCase().replace('.', '') as MediaFileType
      const inputSize = fs.statSync(fsPath).size
      printToChannel(`File input: ${fsPath} - size: ${pb(inputSize)}`)
      const fileName = path.split('/').pop()
      const name = fileName?.split('.')[0]
      const dir = fsPath.replace(fileName!, '')
      const { outFile: oPath, fileName: oFName } = getOutFile(dir, name!, type)

      const t0 = perf.now()
      if (inputExtName === 'svg') await this.preRenderSvgToJpeg(fsPath, oPath)
      else await this.ffmpegConvert(fsPath, oPath)
      const t1 = perf.now()
      const ms = Math.round(t1 - t0)

      const msg = `${fileName} => ${oFName} completed!`
      printToChannel(`${msg}\nTotal time: ${fmtMSS(ms)}`)
      const size = fs.statSync(oPath).size
      printToChannel(`File output: ${oPath} - size: ${pb(size)}\n`)
      showInformationMessage(msg)
    } catch (error: any) {
      if (error.message === 'ffmpeg was killed with signal SIGKILL') {
        showInformationMessage('Conversion was canceled')
        printToChannel('Conversion was canceled')
        return
      }
      showPrintErrorMsg(error)
    }
  }

  private static ffmpegConvert(input: string, output: string) {
    return window.withProgress({
      location: ProgressLocation.Window,
      title: 'Converting',
      cancellable: false
      // There is no progress
    }, () => {
      return new Promise<void>((resolve, reject) => {
        const command = ffmpeg(input).output(output).format('image2')
          .on('error', (err) => reject(err))
          .on('end', () => resolve())
        command.run()
      })
    })
  }

  // private static async preRenderSvgToJpeg(input: string, output: string) {
  //   const image = await loadImage(input)
  //   const canvas = createCanvas(image.width, image.height);
  //   const ctx = canvas.getContext('2d')
  //   ctx.drawImage(image, 0, 0)
  //   // Convert the canvas to a JPG buffer
  //   const buffer = canvas.toBuffer('image/jpeg')

  //   // Write the buffer to a file
  //   fs.writeFileSync(output, buffer)
  // }

  // private static async preRenderSvgToJpeg(input: string, output: string) {
  //   try {
  //     console.log(`Converting SVG to JPEG: ${input} => ${output}`);
  //     // Use sharp to read the SVG and convert it to JPEG
  //     await sharp(input)
  //       .jpeg({ quality: 80 }) // Set JPEG quality (adjustable from 0 to 100)
  //       .toFile(output); // Save the output as a JPEG file

  //     console.log(`Conversion successful: ${output}`);
  //   } catch (error) {
  //     console.error('Error converting SVG to JPEG with sharp:', error);
  //     throw error;
  //   }
  // }

  private static async preRenderSvgToJpeg(input: string, output: string) {
    try {
      console.log(`Converting SVG to JPEG: ${input} => ${output}`);

      // Read the SVG file as a string
      const svgData = fs.readFileSync(input, 'utf8');

      // Render the SVG using Resvg
      const resvg = new Resvg(svgData, {
        fitTo: { mode: 'width', value: 800 }, // Resize to 800px width (optional)
      });

      // Convert the rendered SVG to a JPEG buffer
      const jpegBuffer = resvg.render().asPng();

      // Write the JPEG buffer to the output file
      fs.writeFileSync(output, jpegBuffer);

      console.log(`Conversion successful: ${output}`);
    } catch (error) {
      console.error('Error converting SVG to JPEG with resvg-js:', error);
      throw error;
    }
  }
}
