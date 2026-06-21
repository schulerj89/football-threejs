import { existsSync, readFileSync } from 'node:fs';

const REPORT_PATH = 'test-results/eleven-performance-report.json';
const SUMMARY_PATH = 'test-results/eleven-performance-summary.txt';

if (!existsSync(REPORT_PATH)) {
  console.error(`No performance report found at ${REPORT_PATH}. Run npm run perf:11v11 first.`);
  process.exitCode = 1;
} else {
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as {
    fullBroadcastRuns?: Array<{
      report: {
        frame: {
          median: number;
          p95: number;
          p99: number;
          minimumRollingOneSecondFps: number;
        };
      };
      scenario: string;
    }>;
    summaryText?: string;
  };

  console.log(report.summaryText ?? readOptionalSummary());

  const rows = report.fullBroadcastRuns ?? [];
  if (rows.length > 0) {
    console.log('\nFull broadcast scenarios:');
    for (const row of rows) {
      console.log([
        row.scenario.padEnd(34),
        `median ${row.report.frame.median.toFixed(2)} ms`,
        `p95 ${row.report.frame.p95.toFixed(2)} ms`,
        `p99 ${row.report.frame.p99.toFixed(2)} ms`,
        `minFPS ${row.report.frame.minimumRollingOneSecondFps.toFixed(1)}`,
      ].join(' | '));
    }
  }
}

function readOptionalSummary(): string {
  return existsSync(SUMMARY_PATH)
    ? readFileSync(SUMMARY_PATH, 'utf8')
    : 'Performance report has no summary text.';
}
