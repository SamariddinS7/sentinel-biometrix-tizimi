// Re-export bridge — keeps all existing `../types` and `../../types` imports
// working inside apps/api/src/ without any per-file import changes.
export * from '../../../packages/shared-types/src/index.ts';
