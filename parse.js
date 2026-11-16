import { Marked, Renderer, Tokenizer } from './vendor/marked/marked.esm.js';

const parser = new Marked({
  renderer: new Renderer(),
  tokenizer: new Tokenizer(),
});

const tokenizers = Tokenizer.prototype;

function guard(name, matches) {
  const original = tokenizers[name];
  tokenizers[name] = function guarded(source, ...rest) {
    return matches(source) ? original.call(this, source, ...rest) : undefined;
  };
}

guard('escape', source => source.charCodeAt(0) === 92);
guard('tag', source => source.charCodeAt(0) === 60);
guard('link', source => source.charCodeAt(0) === 91 || (source.charCodeAt(0) === 33 && source.charCodeAt(1) === 91));
guard('reflink', source => source.charCodeAt(0) === 91 || (source.charCodeAt(0) === 33 && source.charCodeAt(1) === 91));
guard('emStrong', source => source.charCodeAt(0) === 42 || source.charCodeAt(0) === 95);
guard('codespan', source => source.charCodeAt(0) === 96);
guard('br', source => source.charCodeAt(0) === 32 || source.charCodeAt(0) === 92);
guard('del', source => source.charCodeAt(0) === 126);
guard('autolink', source => source.charCodeAt(0) === 60);

/** Render one Markdown document with Marked 18.1.3's default configuration. */
export function parse(markdown) {
  return parser.parse(markdown);
}
