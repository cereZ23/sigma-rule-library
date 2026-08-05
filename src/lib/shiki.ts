import type { ShikiTransformer } from 'shiki';

interface HastNode {
  type?: string;
  value?: string;
  children?: HastNode[];
  properties?: Record<string, unknown>;
}

function lineText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(lineText).join('');
}

/**
 * Annotates every Shiki line with its leading-whitespace width
 * (`--indent: Nch`), so the CSS soft-wrap can align wrapped continuations
 * with the line's own indentation (VS Code-style) instead of column 0.
 */
export const indentWrapTransformer: ShikiTransformer = {
  name: 'indent-wrap',
  line(node) {
    const indent = (lineText(node as HastNode).match(/^[ \t]*/) ?? [''])[0].length;
    if (indent > 0) {
      const props = ((node as HastNode).properties ??= {});
      const existing = typeof props.style === 'string' ? `${props.style};` : '';
      props.style = `${existing}--indent:${indent}ch`;
    }
  },
};
