/**
 * Reads the command line of `scripts/lighthouse.mjs`.
 *
 * The parser refuses an unknown flag. A silently ignored flag is a way to
 * believe a run did something it did not do.
 */

const MODES = Object.freeze(['deterministic', 'production']);

const DEFAULT_REPORT_DIR = 'lighthouse-reports';

const fail = (message) => {
  throw new Error(message);
};

function readTarget(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return fail(`The --target must be an absolute address, and ${value} is not one.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`The --target must use http or https, and ${value} does not.`);
  }

  return value.replace(/\/+$/u, '');
}

function readSamples(value) {
  const samples = Number(value);

  if (!Number.isInteger(samples) || samples < 3 || samples % 2 === 0) {
    fail('The --samples value must be an odd whole number of three or more.');
  }

  return samples;
}

/** The options of one run, or an error that names the flag at fault. */
export function parseOptions(argv) {
  let target;
  let mode = 'deterministic';
  let samples;
  let reportDir = DEFAULT_REPORT_DIR;

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (value === undefined) fail(`The ${flag} flag needs a value.`);

    switch (flag) {
      case '--target':
        target = readTarget(value);
        break;
      case '--mode':
        if (!MODES.includes(value)) fail(`The --mode value ${value} is not a mode of this gate.`);
        mode = value;
        break;
      case '--samples':
        samples = readSamples(value);
        break;
      case '--report-dir':
        reportDir = value;
        break;
      default:
        fail(`${flag} is not a flag of this gate.`);
    }
  }

  if (target === undefined) fail('A run needs a --target address to measure.');

  return { target, mode, samples, reportDir };
}
