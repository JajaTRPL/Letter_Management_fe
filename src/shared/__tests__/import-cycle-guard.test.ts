import { describe, expect, it } from 'vitest';

/**
 * C1 architecture guard: the frontend module graph must stay acyclic at the
 * STATIC-import level (dynamic `import()` is a deliberate async navigation
 * boundary, not an init-time edge). This reads every `src/**\/*.ts` source via
 * Vite's eager `?raw` glob — deterministic, dependency-free, scans src only.
 *
 * It also pins the leaf-module boundary: shared design-system / token / adapter
 * modules must never statically import a page renderer.
 */

// Eagerly load all TS sources as raw strings (keys are paths relative to project root).
const rawModules = import.meta.glob('../../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Normalize a glob key (e.g. '../../mahasiswa/Foo.ts') to a 'src/'-relative node.
const toNode = (key: string): string => {
    const idx = key.indexOf('/src/');
    const rel = idx >= 0 ? key.slice(idx + 5) : key.replace(/^(\.\.\/)+/, '');
    return rel.replace(/\\/g, '/');
};

const sources = new Map<string, string>();
for (const [key, code] of Object.entries(rawModules)) {
    const node = toNode(key);
    if (node.endsWith('.d.ts')) continue;
    if (/\.test\.ts$|\/__tests__\/|\/test\//.test(node)) continue; // exclude test files
    sources.set(node, code);
}

const dirOf = (node: string): string => node.split('/').slice(0, -1).join('/');

const resolveSpec = (fromNode: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null;
    const clean = spec.split('?')[0];
    const parts = (dirOf(fromNode) + '/' + clean).split('/');
    const stack: string[] = [];
    for (const p of parts) {
        if (p === '.' || p === '') continue;
        if (p === '..') stack.pop();
        else stack.push(p);
    }
    const base = stack.join('/');
    for (const cand of [`${base}.ts`, `${base}/index.ts`, base]) {
        if (sources.has(cand)) return cand;
    }
    return null;
};

// STATIC edges only (`import ... from`, bare `import '...'`); exclude dynamic import().
const STATIC_RE = /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s*['"]([^'"]+)['"]/g;
const BARE_RE = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

const buildStaticEdges = (): Map<string, Set<string>> => {
    const edges = new Map<string, Set<string>>();
    for (const [node, codeRaw] of sources) {
        // Strip dynamic imports so `import('x')` never counts as a static edge.
        const code = codeRaw.replace(/import\(\s*['"][^'"]+['"]\s*\)/g, '');
        const set = new Set<string>();
        for (const re of [STATIC_RE, BARE_RE]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(code))) {
                const target = resolveSpec(node, m[1]);
                if (target && target !== node) set.add(target);
            }
        }
        edges.set(node, set);
    }
    return edges;
};

const findCyclicSccs = (edges: Map<string, Set<string>>): string[][] => {
    let index = 0;
    const idx = new Map<string, number>(), low = new Map<string, number>(), onStack = new Map<string, boolean>();
    const stack: string[] = [];
    const sccs: string[][] = [];
    const strongconnect = (v: string): void => {
        idx.set(v, index); low.set(v, index); index++; stack.push(v); onStack.set(v, true);
        for (const w of edges.get(v) ?? []) {
            if (!idx.has(w)) { strongconnect(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
            else if (onStack.get(w)) { low.set(v, Math.min(low.get(v)!, idx.get(w)!)); }
        }
        if (low.get(v) === idx.get(v)) {
            const comp: string[] = [];
            let w: string;
            do { w = stack.pop()!; onStack.set(w, false); comp.push(w); } while (w !== v);
            sccs.push(comp);
        }
    };
    for (const v of edges.keys()) if (!idx.has(v)) strongconnect(v);
    return sccs.filter((c) => c.length > 1 || edges.get(c[0])?.has(c[0]));
};

describe('frontend import-cycle guard (C1)', () => {
    it('loaded a meaningful set of source modules', () => {
        expect(sources.size).toBeGreaterThan(100);
    });

    it('has no static import cycle (acyclic module graph)', () => {
        const cyclic = findCyclicSccs(buildStaticEdges());
        const detail = cyclic.map((c) => c.sort().join(' <-> '));
        expect(detail).toEqual([]);
    });

    it('keeps the semantic design-system leaf domain-free of page-renderer imports', () => {
        const leaves = ['shared/design-system.ts', 'shared/ui-primitives.ts', 'shared/letter-presentation.ts'];
        const edges = buildStaticEdges();
        for (const leaf of leaves) {
            for (const target of edges.get(leaf) ?? []) {
                expect(target.startsWith('dashboard/')).toBe(false);
                expect(target.startsWith('login/')).toBe(false);
                expect(target.startsWith('tendik/')).toBe(false);
                expect(target.startsWith('akademik/')).toBe(false);
                // letter-presentation may use form-primitives (a shared leaf); it must
                // not reach a Mahasiswa *page* renderer.
                expect(target.endsWith('Form.ts')).toBe(false);
                expect(target.endsWith('Dashboard.ts')).toBe(false);
            }
        }
    });
});
