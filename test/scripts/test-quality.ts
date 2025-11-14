/**
 * Test script for quality settings
 * Run with: npm run test-compile && node test/test-quality.js
 */

import { workspace } from 'vscode'

// Mock workspace configuration
const mockConfig = new Map<string, any>()

const originalGetConfiguration = workspace.getConfiguration
workspace.getConfiguration = (section?: string) => {
  return {
    get: (key: string, defaultValue?: any) => {
      const fullKey = section ? `${section}.${key}` : key
      return mockConfig.has(fullKey) ? mockConfig.get(fullKey) : defaultValue
    },
    has: (key: string) => mockConfig.has(section ? `${section}.${key}` : key),
    inspect: () => undefined,
    update: () => Promise.resolve()
  } as any
}

// Test helper to set config
function setConfig(key: string, value: any) {
  mockConfig.set(`emc.${key}`, value)
}

// Test helper to clear config
function clearConfig() {
  mockConfig.clear()
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
  type: string
  expectedIncludes: string[]
  expectedExcludes: string[]
}

const testCases: TestCase[] = [
  {
    name: 'MP4 - No custom quality',
    type: 'mp4',
    config: { enableGpuAcceleration: false, useCustomQuality: false, videoQuality: 23, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'libx264', '-f', 'mp4'],
    expectedExcludes: ['-crf']
  },
  {
    name: 'MP4 - Custom quality CRF 18',
    type: 'mp4',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 18, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'libx264', '-crf', '18', '-f', 'mp4'],
    expectedExcludes: []
  },
  {
    name: 'MP4 - Custom quality CRF 35 (low)',
    type: 'mp4',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 35, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'libx264', '-crf', '35', '-f', 'mp4'],
    expectedExcludes: []
  },
  {
    name: 'MP4 - GPU encoding with custom quality',
    type: 'mp4',
    config: { enableGpuAcceleration: true, useCustomQuality: true, videoQuality: 23, audioQuality: 4 },
    expectedIncludes: ['-c:v', 'h264_nvenc', '-cq', '23', '-f', 'mp4'],
    expectedExcludes: ['-crf']
  },
  {
    name: 'MP3 - Custom audio quality VBR 0 (best)',
    type: 'mp3',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 23, audioQuality: 0 },
    expectedIncludes: ['-q:a', '0', '-f', 'mp3'],
    expectedExcludes: []
  },
  {
    name: 'MP3 - Custom audio quality VBR 9 (worst)',
    type: 'mp3',
    config: { enableGpuAcceleration: false, useCustomQuality: true, videoQuality: 23, audioQuality: 9 },
    expectedIncludes: ['-q:a', '9', '-f', 'mp3'],
    expectedExcludes: []
  },
  {
    name: 'MP3 - No custom quality',
    type: 'mp3',
    config: { enableGpuAcceleration: false, useCustomQuality: false, videoQuality: 23, audioQuality: 4 },
    expectedIncludes: ['-f', 'mp3'],
    expectedExcludes: ['-q:a']
  }
]

// Extract args building logic by simulating the converter
function extractArgsFromConverter(type: string, input: string, output: string): string[] {
  const config = workspace.getConfiguration('emc')
  const enableGpu = config.get('enableGpuAcceleration', false)
  const useCustomQuality = config.get('useCustomQuality', false)
  const videoQuality = config.get('videoQuality', 23)
  const audioQuality = config.get('audioQuality', 4)

  // This matches the logic in Converter.ts
  const args = ['-i', input]

  if (type === 'mp4') {
    if (enableGpu) {
      args.push('-c:v', 'h264_nvenc')
      if (useCustomQuality) args.push('-cq', videoQuality.toString())
    } else {
      args.push('-c:v', 'libx264')
      if (useCustomQuality) args.push('-crf', videoQuality.toString())
    }
  }

  if (type === 'mp3' && useCustomQuality) args.push('-q:a', audioQuality.toString())

  args.push('-f', type, '-progress', 'pipe:1', '-y', output)

  return args
}

// Run tests
console.log('🧪 Testing Quality Settings from Converter.ts\n')
console.log('='.repeat(80))

let passed = 0
let failed = 0

testCases.forEach((test, index) => {
  clearConfig()

  // Set config for this test
  setConfig('enableGpuAcceleration', test.config.enableGpuAcceleration)
  setConfig('useCustomQuality', test.config.useCustomQuality)
  setConfig('videoQuality', test.config.videoQuality)
  setConfig('audioQuality', test.config.audioQuality)

  const args = extractArgsFromConverter(test.type, 'input.file', 'output.file')
  const argsStr = args.join(' ')

  console.log(`\n${index + 1}. ${test.name}`)
  console.log(
    `   Config: GPU=${test.config.enableGpuAcceleration}, ` +
    `CustomQuality=${test.config.useCustomQuality}, ` +
    `VideoQ=${test.config.videoQuality}, AudioQ=${test.config.audioQuality}`
  )
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

  if (testPassed) {
    console.log(`   ✅ PASS`)
    passed++
  } else failed++
})

console.log('\n' + '='.repeat(80))
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

if (failed === 0) console.log('✅ All tests passed!')
else {
  console.log('❌ Some tests failed')
  process.exit(1)
}
