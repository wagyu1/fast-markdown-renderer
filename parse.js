import { marked } from './vendor/marked/marked.esm.js';

/** Render one Markdown document with Marked 18.1.3's default configuration. */
export function parse(markdown) {
  return marked.parse(markdown);
}
