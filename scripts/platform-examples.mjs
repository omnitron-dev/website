import ts from 'typescript';
import { parseDocumentSync } from '@omnitron-dev/lumen-ast';

const kinds = new Map([
  ['typescript', ts.ScriptKind.TS], ['ts', ts.ScriptKind.TS], ['mts', ts.ScriptKind.TS], ['cts', ts.ScriptKind.TS],
  ['tsx', ts.ScriptKind.TSX], ['jsx', ts.ScriptKind.JSX],
  ['javascript', ts.ScriptKind.JS], ['js', ts.ScriptKind.JS], ['mjs', ts.ScriptKind.JS], ['cjs', ts.ScriptKind.JS],
]);

/** Read the same fences as the published page, including nested blocks and their original lines. */
export function* platformExamples(text, file) {
  if (!text.includes('@omnitron-dev/')) return;
  function* visit(node) {
    if (node.type === 'codeBlock') {
      const kind = kinds.get(node.lang?.toLowerCase());
      if (kind !== undefined) {
        const source = ts.createSourceFile(file, node.value ?? '', ts.ScriptTarget.Latest, true, kind);
        const imports = source.statements.filter(statement => ts.isImportDeclaration(statement)
          && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith('@omnitron-dev/'));
        if (imports.length) yield { source, imports, line: (node.position?.start.line ?? 1) + 1 };
      }
    }
    for (const child of node.children ?? []) yield* visit(child);
  }
  yield* visit(parseDocumentSync(text, file));
}
