const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

const ffmpeg = require('ffmpeg-static');

const TARGET_I = -22.5;
const TARGET_TP = -1.5;
const TARGET_LRA = 11;
const FILES = [
  'public/sfx/result/clear_success1.mp3',
  'public/sfx/result/clear_success2.mp3'
];

const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null';

function runFfmpeg(args) {
  const result = spawnSync(ffmpeg, args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg failed: ${args.join(' ')}`);
  }
  return result;
}

function parseLoudnorm(stderr) {
  const matches = stderr.match(/\{[\s\S]*?\}/g);
  if (!matches || matches.length === 0) {
    throw new Error('Failed to locate loudnorm statistics in ffmpeg output');
  }
  return JSON.parse(matches[matches.length - 1]);
}

function formatDb(num) {
  return Number.parseFloat(num).toFixed(2);
}

function normalize(file) {
  console.log(`Analyzing: ${file}`);
  const firstPass = runFfmpeg([
    '-hide_banner',
    '-i',
    file,
    '-filter_complex',
    `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json`,
    '-f',
    'null',
    NULL_DEVICE
  ]);
  const stats = parseLoudnorm(firstPass.stderr);
  const adjustment = TARGET_I - Number.parseFloat(stats.input_i);
  console.log(`  current I: ${formatDb(stats.input_i)} LUFS, gain diff: ${formatDb(adjustment)} dB`);

  const tempOutput = file.replace(/\.mp3$/i, '.normalized.mp3');
  const secondPassArgs = [
    '-hide_banner',
    '-y',
    '-i',
    file,
    '-filter_complex',
    [
      `loudnorm=I=${TARGET_I}`,
      `TP=${TARGET_TP}`,
      `LRA=${TARGET_LRA}`,
      `measured_I=${stats.input_i}`,
      `measured_TP=${stats.input_tp}`,
      `measured_LRA=${stats.input_lra}`,
      `measured_thresh=${stats.input_thresh}`,
      `offset=${stats.target_offset}`,
      'linear=true',
      'print_format=json'
    ].join(':'),
    '-c:a',
    'libmp3lame',
    '-b:a',
    '256k',
    tempOutput
  ];
  const secondPass = runFfmpeg(secondPassArgs);
  parseLoudnorm(secondPass.stderr);

  const backupCandidate = file.replace(/\.mp3$/i, '_original.mp3');
  let backupPath = backupCandidate;
  if (fs.existsSync(backupCandidate)) {
    const { dir, name, ext } = path.parse(file);
    backupPath = path.join(dir, `${name}_original_${Date.now()}${ext}`);
  }
  fs.renameSync(file, backupPath);
  fs.renameSync(tempOutput, file);
  console.log(`  wrote normalized file, backup saved to ${backupPath}`);
}

for (const file of FILES) {
  normalize(file);
}
