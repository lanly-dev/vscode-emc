/**
 * Test script for quality settings
 * Run with: npm run test:quality
 */

import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

// Test configuration type
interface TestConfig {
  enableGpuAcceleration: boolean
  useCustomQuality: boolean
  videoQuality: number
  audioQuality: number
}

// Mock config
let currentConfig: TestConfig = {
  enableGpuAcceleration: false,
  useCustomQuality: false,
  videoQuality: 23,
  audioQuality: 4
}

// Test helper to set config
function setConfig(config: Partial<TestConfig>) {
  currentConfig = { ...currentConfig, ...config }
}

// Test cases
interface TestCase {
  name: string
  config: {
    enableGpuAcceleration: boolean
    useCustomQuality: boolean
    videoQuality: number
    audioQuality: number
  }
  inputFile: string
  type: string
  expectedIncludes: string[]
  expectedExcludes: string[]
}

const testDir = path.join(__dirname, '..')
const testCases: TestCase[] = [
  {
    name: 'MP4 - No custom quality',
    inputFile: path.join(testDir, 'big-buck-bunny_trailer.mp4'),
    type: 'mp4',
    config: { enableGpuAcceleration: false, useCustomQuality: false, videoQuality: 23, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'libx264', '-f', 'mp4'],
    expectedExcludes: ['-crf']
  },
  {
    name: 'MP4 - Custom quality CRF 18',
    inputFile: path.join(testDir, 'big-buck-bunny_trailer.mp4'),
    type: 'mp4',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 18, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'libx264', '-crf', '18', '-f', 'mp4'],
    expectedExcludes: []
  },
  {
    name: 'MP4 - Custom quality CRF 35 (low)',
    inputFile: path.join(testDir, 'big-buck-bunny_trailer.mp4'),
    type: 'mp4',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 35, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'libx264', '-crf', '35', '-f', 'mp4'],
    expectedExcludes: []
  },
  {
    name: 'MP3 - Custom audio quality VBR 0 (best)',
    inputFile: path.join(testDir, 'Free_Test_Data_1OMB_MP3.mp3'),
    type: 'mp3',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 23, audioQuality: 0 },
    expectedIncludes: ['-q:a', '0', '-f', 'mp3'],
    expectedExcludes: []
  },
  {
    name: 'MP3 - No custom quality',
    inputFile: path.join(testDir, 'Free_Test_Data_1OMB_MP3.mp3'),
    type: 'mp3',
    config: { enableGpuAcceleration: false, useCustomQuality: false, videoQuality: 23, audioQuality: 4 },
    expectedIncludes: ['-f', 'mp3'],
    expectedExcludes: ['-q:a']
  }
]

// Simulate the args building logic from Converter.ts
function buildFfmpegArgs(type: string, input: string, output: string): string[] {
  const { enableGpuAcceleration, useCustomQuality, videoQuality, audioQuality } = currentConfig

  const args = ['-i', input]

  // Video codec settings
  if (type === 'mp4') {
    if (enableGpuAcceleration) {
      args.push('-c:v', 'h264_nvenc')
      if (useCustomQuality) args.push('-cq', videoQuality.toString())
    } else {
      args.push('-c:v', 'libx264')
      if (useCustomQuality) args.push('-crf', videoQuality.toString())
    }
  }

  // Audio quality settings
  if (type === 'mp3' && useCustomQuality) args.push('-q:a', audioQuality.toString())

  args.push('-f', type, '-progress', 'pipe:1', '-y', output)

  return args
}

// Helper to run ffmpeg and get output file size
function runFfmpeg(pathToFfmpeg: string, args: string[]): Promise<{ success: boolean, outputSize: number }> {
  return new Promise((resolve) => {
    const ffmpegProcess = spawn(pathToFfmpeg, args)
    let errorOutput = ''

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString()
    })

    ffmpegProcess.on('close', (code) => {
      const outputFile = args[args.length - 1]
      let outputSize = 0

      if (code === 0 && fs.existsSync(outputFile))
        outputSize = fs.statSync(outputFile).size

      resolve({ success: code === 0, outputSize })
    })
  })
}

// Run tests
async function runTests() {
  // Get ffmpeg path from bin directory
  const binPath = path.join(__dirname, '..', '..', 'bin')
  const platform = process.platform
  let ffmpegPath: string

  if (platform === 'win32') ffmpegPath = path.join(binPath, 'ffmpeg.exe')
  else if (platform === 'darwin') ffmpegPath = path.join(binPath, 'ffmpeg')
  else ffmpegPath = path.join(binPath, 'ffmpeg')

  // Check if ffmpeg exists in bin, otherwise use system ffmpeg
  if (!fs.existsSync(ffmpegPath)) {
    console.error('❌ ERROR: ffmpeg not found in bin directory')
    console.error(`   Expected path: ${ffmpegPath}`)
    console.error('   Please download ffmpeg first using the extension')
    process.exit(1)
  }

  console.log(`✅ Using ffmpeg from: ${ffmpegPath}`)

  console.log('\n🧪 Testing Converter Quality Settings with Real Files\n')
  console.log('='.repeat(80))

  let passed = 0
  let failed = 0

  for (const [index, test] of testCases.entries()) {
    setConfig(test.config)

    const outputFile = test.inputFile.replace(
      path.extname(test.inputFile),
      `-test-${index}.${test.type}`
    )
    const args = buildFfmpegArgs(test.type, test.inputFile, outputFile)
    const argsStr = args.join(' ')

    console.log(`\n${index + 1}. ${test.name}`)
    console.log(
      `   Config: GPU=${test.config.enableGpuAcceleration}, ` +
      `CustomQuality=${test.config.useCustomQuality}, ` +
      `VideoQ=${test.config.videoQuality}, AudioQ=${test.config.audioQuality}`
    )
    console.log(`   Input: ${path.basename(test.inputFile)}`)
    console.log(`   Command: ffmpeg ${argsStr}`)

    let testPassed = true

    // Check expected includes
    test.expectedIncludes.forEach(expected => {
      if (!args.includes(expected)) {
        console.log(`   ❌ FAIL: Expected "${expected}" in args`)
        testPassed = false
      }
    })

    // Check expected excludes
    test.expectedExcludes.forEach(excluded => {
      if (args.includes(excluded)) {
        console.log(`   ❌ FAIL: Did not expect "${excluded}" in args`)
        testPassed = false
      }
    })

    if (testPassed && fs.existsSync(test.inputFile)) {
      console.log(`   🔄 Running ffmpeg...`)
      const { success, outputSize } = await runFfmpeg(ffmpegPath, args)

      if (success) {
        console.log(`   ✅ PASS - Output size: ${(outputSize / 1024).toFixed(2)} KB`)
        passed++

        // Clean up output file
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)

        // // Move output file to scripts directory
        // const scriptsDir = path.join(__dirname)
        // const finalOutput = path.join(scriptsDir, path.basename(outputFile))
        // if (fs.existsSync(outputFile)) {
        //   fs.renameSync(outputFile, finalOutput)
        //   console.log(`   📁 Saved to: ${finalOutput}`)
        // }
      } else {
        console.log(`   ❌ FAIL: ffmpeg conversion failed`)
        failed++
      }
    } else if (!testPassed)
      failed++
    else
      console.log(`   ⚠️  SKIP: Input file not found`)
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

  if (failed === 0)
    console.log('✅ All tests passed!')
  else {
    console.log('❌ Some tests failed')
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
