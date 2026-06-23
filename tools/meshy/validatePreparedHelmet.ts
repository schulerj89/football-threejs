import {
  HELMET_COMBINED_RUNTIME_PATH,
  HELMET_FACEGUARD_RUNTIME_PATH,
  HELMET_MANIFEST_RUNTIME_PATH,
  HELMET_METADATA_DIR,
  HELMET_SHELL_RUNTIME_PATH,
  isDirectCli,
  resolveRepoPath,
  writeJsonFile,
} from './schemas';
import { auditGlbAsset } from './helmetAssetReport';

export interface PreparedHelmetValidationReport {
  readonly failures: readonly string[];
  readonly passed: boolean;
  readonly totalTriangles: number;
}

export function validatePreparedHelmet(): PreparedHelmetValidationReport {
  const failures: string[] = [];
  const combined = auditGlbAsset(HELMET_COMBINED_RUNTIME_PATH);
  const shell = auditGlbAsset(HELMET_SHELL_RUNTIME_PATH);
  const faceguard = auditGlbAsset(HELMET_FACEGUARD_RUNTIME_PATH);

  if (!combined.meshNames.includes('helmet_shell') || !combined.meshNames.includes('faceguard_standard')) {
    failures.push('Combined helmet must contain helmet_shell and faceguard_standard meshes.');
  }
  if (!combined.materialNames.includes('mat_helmet_shell') || !combined.materialNames.includes('mat_faceguard')) {
    failures.push('Combined helmet must contain mat_helmet_shell and mat_faceguard materials.');
  }
  if (shell.meshNames.length !== 1 || shell.meshNames[0] !== 'helmet_shell') {
    failures.push('Standalone shell must contain only helmet_shell.');
  }
  if (faceguard.meshNames.length !== 1 || faceguard.meshNames[0] !== 'faceguard_standard') {
    failures.push('Standalone faceguard must contain only faceguard_standard.');
  }
  if (combined.triangleCount > 8500) {
    failures.push(`Combined triangle count ${combined.triangleCount} exceeds 8500.`);
  }
  if (!combined.shellFaceguardSeparable) {
    failures.push('Combined helmet is not reported as separable.');
  }
  if (shell.triangleCount <= 0 || faceguard.triangleCount <= 0) {
    failures.push('Shell and faceguard must both contain triangles.');
  }

  return {
    failures,
    passed: failures.length === 0,
    totalTriangles: combined.triangleCount,
  };
}

if (isDirectCli(import.meta.url)) {
  try {
    const report = validatePreparedHelmet();
    writeJsonFile(resolveRepoPath(`${HELMET_METADATA_DIR}/helmet-validation-report.json`), {
      ...report,
      manifestPath: HELMET_MANIFEST_RUNTIME_PATH,
      runtimePaths: [
        HELMET_COMBINED_RUNTIME_PATH,
        HELMET_SHELL_RUNTIME_PATH,
        HELMET_FACEGUARD_RUNTIME_PATH,
      ],
      validatedAt: new Date().toISOString(),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
