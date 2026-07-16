/**
 * Sentinel VMS — Diagnostics Engine Tests
 * Tests for structured diagnostic pipeline against camera endpoints.
 *
 * Run: npx tsx tests/camera/diagnostics.test.ts
 * Note: Most steps will return FAIL in CI/sandbox (no real cameras), but
 *       the pipeline must NEVER throw — it always returns a DiagnosticReport.
 */

import { diagnosticsEngine, DiagnosticTarget } from '../../services/camera/DiagnosticsEngine';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  process.stdout.write(`[PASS] ${msg}\n`);
}

async function testUnreachableHost() {
  const target: DiagnosticTarget = {
    cameraId: 'test-diag-unreachable',
    ip: '10.255.255.1', // Non-routable
    rtspPort: 554,
    onvifPort: 80,
  };

  const report = await diagnosticsEngine.run(target);

  assert(typeof report.overallStatus === 'string', 'overallStatus must be a string');
  assert(report.overallStatus === 'UNREACHABLE', `Expected UNREACHABLE, got ${report.overallStatus}`);
  assert(Array.isArray(report.steps), 'steps must be an array');
  assert(report.steps.length === 8, `Expected 8 steps, got ${report.steps.length}`);
  assert(report.steps[0].step === 1, 'First step must be step 1');
  assert(report.steps[0].name === 'TCP Ping', 'First step must be TCP Ping');
  assert(report.steps[0].status === 'FAIL', 'TCP Ping must FAIL for unreachable host');
  assert(typeof report.steps[0].durationMs === 'number', 'durationMs must be a number');
  assert(Array.isArray(report.logs), 'logs must be an array');
  assert(typeof report.summary === 'string', 'summary must be a string');
  assert(typeof report.generatedAt === 'string', 'generatedAt must be a string');
}

async function testRawIpSkipsDns() {
  const target: DiagnosticTarget = {
    cameraId: 'test-diag-rawip',
    ip: '192.168.0.1',
    rtspPort: 554,
  };

  const report = await diagnosticsEngine.run(target);
  const dnsStep = report.steps.find(s => s.step === 2)!;
  assert(dnsStep.status === 'SKIPPED', `DNS step must be SKIPPED for raw IP, got ${dnsStep.status}`);
}

async function testSkippedStepsForMinimalTarget() {
  const target: DiagnosticTarget = {
    cameraId: 'test-diag-minimal',
    ip: '10.0.0.1',
    // No rtspPort, no onvifPort, no credentials
  };

  const report = await diagnosticsEngine.run(target);

  const rtspStep = report.steps.find(s => s.step === 3)!;
  assert(rtspStep.status === 'SKIPPED', 'RTSP probe must be SKIPPED if no rtspPort');

  const onvifStep = report.steps.find(s => s.step === 4)!;
  assert(onvifStep.status === 'SKIPPED', 'ONVIF probe must be SKIPPED if no onvifPort');

  const authStep = report.steps.find(s => s.step === 5)!;
  assert(authStep.status === 'SKIPPED', 'Auth must be SKIPPED if no credentials');
}

async function testReportStructure() {
  const target: DiagnosticTarget = {
    cameraId: 'test-diag-struct',
    ip: '10.255.1.1',
    rtspPort: 554,
    onvifPort: 80,
    username: 'admin',
    encryptedPassword: 'test',
  };

  const report = await diagnosticsEngine.run(target);

  assert(report.cameraId === 'test-diag-struct', 'cameraId must match');
  assert(report.targetHost === '10.255.1.1', 'targetHost must match');
  assert(['HEALTHY', 'DEGRADED', 'UNREACHABLE', 'AUTH_FAILURE'].includes(report.overallStatus),
    `overallStatus must be a valid value: ${report.overallStatus}`);
  
  for (const step of report.steps) {
    assert(step.step >= 1 && step.step <= 8, `Step number must be 1-8: ${step.step}`);
    assert(['PASS', 'FAIL', 'SKIPPED', 'WARNING'].includes(step.status),
      `Step status must be valid: ${step.status}`);
    assert(typeof step.durationMs === 'number', `durationMs must be number: ${typeof step.durationMs}`);
  }
}

async function runAll() {
  process.stdout.write('=== Diagnostics Engine Tests ===\n');
  await testUnreachableHost();
  await testRawIpSkipsDns();
  await testSkippedStepsForMinimalTarget();
  await testReportStructure();
  process.stdout.write('=== All Diagnostics Tests Passed ===\n');
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
