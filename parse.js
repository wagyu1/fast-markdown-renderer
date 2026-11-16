import { Marked, Renderer, Tokenizer } from './vendor/marked/marked.esm.js';

const parser = new Marked({
  renderer: new Renderer(),
  tokenizer: new Tokenizer(),
});

/** Render one Markdown document with Marked 18.1.3's default configuration. */
export function parse(markdown) {
  return parser.parse(markdown);
}
