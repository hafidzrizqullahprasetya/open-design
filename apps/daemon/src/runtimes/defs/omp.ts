import { DEFAULT_MODEL_OPTION, execAgentFile } from './shared.js';
import type { RuntimeAgentDef, RuntimeModelOption } from '../types.js';

export function parseOmpModels(stdout: unknown): RuntimeModelOption[] | null {
  try {
    const raw = typeof stdout === 'string' ? JSON.parse(stdout) : stdout;
    const list = Array.isArray(raw?.models) ? raw.models : [];
    if (list.length === 0) return null;
    const entries: RuntimeModelOption[] = [DEFAULT_MODEL_OPTION];
    const seen = new Set(['default']);
    for (const m of list) {
      const id = m?.selector || (m?.provider && m?.id ? `${m.provider}/${m.id}` : m?.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const label = m?.name ? `${m.name} (${m.provider || ''})`.trim() : id;
      entries.push({ id, label });
    }
    return entries.length > 1 ? entries : null;
  } catch {
    return null;
  }
}

export const ompAgentDef = {
  id: 'omp',
  name: 'Oh My Pi',
  bin: 'omp',
  versionArgs: ['--version'],
  versionProbeTimeoutMs: 15_000,
  fetchModels: async (resolvedBin, env) => {
    try {
      const { stdout } = await execAgentFile(resolvedBin, ['models', '--json'], {
        env,
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const parsed = parseOmpModels(stdout);
      if (!parsed || parsed.length === 0) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  // Used only when `omp models --json` fails; `default` keeps omp's own
  // modelRoles.default from ~/.omp/agent/config.yml.
  fallbackModels: [
    DEFAULT_MODEL_OPTION,
    {
      id: 'octane/ag/gemini-3.8-flash-high',
      label: 'Gemini 3.8 Flash High (octane)',
    },
  ],
  reasoningOptions: [
    { id: 'default', label: 'Default' },
    { id: 'off', label: 'Off' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'xhigh', label: 'XHigh' },
  ],
  buildArgs: (
    _prompt,
    _imagePaths,
    extraAllowedDirs = [],
    options = {},
    _runtimeContext = {},
  ) => {
    const args = ['--mode', 'rpc'];
    if (options.model && options.model !== 'default') {
      args.push('--model', options.model);
    }
    if (options.reasoning && options.reasoning !== 'default') {
      args.push('--thinking', options.reasoning);
    }
    const dirs = (extraAllowedDirs || []).filter(
      (d) => typeof d === 'string' && d.length > 0,
    );
    for (const d of dirs) {
      args.push('--add-dir', d);
    }
    return args;
  },
  promptViaStdin: true,
  streamFormat: 'pi-rpc',
  supportsImagePaths: true,
} satisfies RuntimeAgentDef;
