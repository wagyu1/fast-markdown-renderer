/**
 * Hand-written scanner for the GFM `inlineText` rule.
 *
 * The regular expression it replaces is
 *
 *   ^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)
 *     |(?=[EMAIL]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)
 *     |[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)
 *     |[^EMAIL](?=[EMAIL]+@))))
 *
 * (`[EMAIL]` is `[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]`). It is evaluated once per
 * inline token, and its lazy `[\s\S]*?` carries an expensive lookahead
 * alternation that is retried at every character, which makes it quadratic on
 * long text runs. The scanner below walks the same characters with table
 * lookups and returns exactly the same match.
 *
 * Anything the scanner is not certain about (non-Latin-1 characters, which make
 * `\s` and case folding subtler than a code-unit table can express) falls back
 * to the original regular expression.
 */

const STOP = new Uint8Array(128);
for (const ch of '\\<![') STOP[ch.charCodeAt(0)] = 1;
STOP[96] = 1; // `
STOP[42] = 1; // *
STOP[126] = 1; // ~
STOP[95] = 1; // _

/** Characters worth a closer look: the stopping set plus link and protocol starts. */
const SPECIAL = new Uint8Array(128);
for (let i = 0; i < 128; i++) SPECIAL[i] = STOP[i];
SPECIAL[104] = 1; // h
SPECIAL[72] = 1; // H
SPECIAL[102] = 1; // f
SPECIAL[70] = 1; // F
SPECIAL[119] = 1; // w
SPECIAL[109] = 1; // m, as in `mailto:`
SPECIAL[120] = 1; // x, as in `xmpp:`

const EMAIL = new Uint8Array(128);
for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789.!#$%&'*+/=?_`{|}~-") {
  EMAIL[ch.charCodeAt(0)] = 1;
  EMAIL[ch.toUpperCase().charCodeAt(0)] = 1;
}

/** `\s`, `*`, `_`, `~` or `(` — the character class of the `www.` lookbehind. */
const isWwwBoundary = (code: number) => {
  if (code <= 127) {
    return code === 32 || code === 42 || code === 95 || code === 126 || code === 40
      || code === 9 || code === 10 || code === 13 || code === 11 || code === 12;
  }
  return false;
};

const isAlnum = (code: number) => (code >= 48 && code <= 57)
  || (code >= 65 && code <= 90)
  || (code >= 97 && code <= 122);

const isEmailChar = (code: number) => code <= 127 && EMAIL[code] === 1;

/** `[hH][tT][tT][pP]` at `i`. */
const isHttpAt = (src: string, i: number) => {
  if (i + 3 >= src.length) return false;
  const a = src.charCodeAt(i);
  const b = src.charCodeAt(i + 1);
  const c = src.charCodeAt(i + 2);
  const d = src.charCodeAt(i + 3);
  return (a === 104 || a === 72) && (b === 116 || b === 84)
    && (c === 116 || c === 84) && (d === 112 || d === 80);
};

/** `[fF][tT][tPp]:\/\/` at `i`. */
const isFtpAt = (src: string, i: number) => {
  if (i + 5 >= src.length) return false;
  const a = src.charCodeAt(i);
  const b = src.charCodeAt(i + 1);
  const c = src.charCodeAt(i + 2);
  return (a === 102 || a === 70) && (b === 116 || b === 84)
    && (c === 116 || c === 84 || c === 112 || c === 80)
    && src.charCodeAt(i + 3) === 58
    && src.charCodeAt(i + 4) === 47
    && src.charCodeAt(i + 5) === 47;
};

/** `www\.` at `i`, given that the GFM lookbehind already accepted the position. */
const isWwwAt = (src: string, i: number) => {
  if (i + 3 >= src.length) return false;
  if (src.charCodeAt(i) !== 119) return false; // lowercase `w` only
  if (src.charCodeAt(i + 1) !== 119 || src.charCodeAt(i + 2) !== 119) return false;
  return src.charCodeAt(i + 3) === 46;
};

const startsWithAt = (src: string, i: number, literal: string) => {
  if (i + literal.length > src.length) return false;
  for (let k = 0; k < literal.length; k++) {
    if (src.charCodeAt(i + k) !== literal.charCodeAt(k)) return false;
  }
  return true;
};

/** `[EMAIL]+@` at `i`. */
const isEmailStartAt = (src: string, i: number) => {
  const len = src.length;
  let k = i;
  while (k < len && isEmailChar(src.charCodeAt(k))) k++;
  return k > i && k < len && src.charCodeAt(k) === 64 && k > i;
};

/** ` {2,}\n` at `i`. */
const isHardBreakAt = (src: string, i: number) => {
  const len = src.length;
  if (i >= len || src.charCodeAt(i) !== 32) return false;
  let k = i + 1;
  if (k >= len || src.charCodeAt(k) !== 32) return false;
  while (k < len && src.charCodeAt(k) === 32) k++;
  return k < len && src.charCodeAt(k) === 10;
};

export const scanInlineText = (src: string, fallback: RegExp): string | undefined => {
  const len = src.length;
  if (len === 0) return undefined;

  const first = src.charCodeAt(0);

  // Alternative 1: a single non-alphanumeric character ahead of an email
  // protocol prefix (`mailto:`, `xmpp:`).
  if (!isAlnum(first)
    && (startsWithAt(src, 1, 'mailto:') || startsWithAt(src, 1, 'xmpp:'))) {
    return src.slice(0, 1);
  }

  // Alternative 2 prefix: `(`+|~+|[^`~])`.
  let prefixEnd = 1;
  if (first === 96) {
    while (prefixEnd < len && src.charCodeAt(prefixEnd) === 96) prefixEnd++;
  } else if (first === 126) {
    while (prefixEnd < len && src.charCodeAt(prefixEnd) === 126) prefixEnd++;
  }
  if (prefixEnd >= len) return src;

  const after = src.charCodeAt(prefixEnd);
  if (after === 96 || after === 126) return src.slice(0, prefixEnd);
  if (after === 32 && isHardBreakAt(src, prefixEnd)) return src.slice(0, prefixEnd);
  if (isEmailChar(after) && isEmailStartAt(src, prefixEnd)) return src.slice(0, prefixEnd);

  // Both remaining one-character alternatives need a far-away anchor: the match
  // ends just before an email address, or just before a hard line break. Each
  // anchor has at most one possible trigger position, so they are resolved once
  // here instead of being re-tested at every character.
  let emailTrigger = len;
  let at = src.indexOf('@', 1);
  let atProbes = 0;
  while (at > 0) {
    let k = at;
    while (k > 0 && isEmailChar(src.charCodeAt(k - 1))) k--;
    // an `@` with no address characters before it cannot end a match
    if (k < at && k > 0) {
      emailTrigger = k - 1;
      break;
    }
    if (++atProbes > 8) return fallback.exec(src)?.[0];
    at = src.indexOf('@', at + 1);
  }

  let breakTrigger = len;
  let spaces = src.indexOf('  ', prefixEnd);
  let probes = 0;
  while (spaces >= 0) {
    if (++probes > 8) return fallback.exec(src)?.[0];
    let k = spaces;
    while (k < len && src.charCodeAt(k) === 32) k++;
    if (k < len && src.charCodeAt(k) === 10) {
      breakTrigger = spaces - 1;
      break;
    }
    spaces = src.indexOf('  ', spaces + 1);
  }

  if (emailTrigger < prefixEnd) emailTrigger = len;
  if (breakTrigger < prefixEnd) breakTrigger = len;

  const limit = emailTrigger < breakTrigger ? emailTrigger : breakTrigger;

  let i = prefixEnd;
  while (i < limit) {
    const code = src.charCodeAt(i);
    if (code >= 128) return fallback.exec(src)?.[0];
    if (SPECIAL[code] === 1) {
      if (STOP[code] === 1) return src.slice(0, i);
      if (code === 104 || code === 72) {
        if (isHttpAt(src, i)) return src.slice(0, i);
      } else if (code === 102 || code === 70) {
        if (isFtpAt(src, i)) return src.slice(0, i);
      } else if (code === 119) {
        if (isWwwAt(src, i) && (i === 0 || isWwwBoundary(src.charCodeAt(i - 1)))) {
          return src.slice(0, i);
        }
      } else if (i > prefixEnd && !isAlnum(src.charCodeAt(i - 1))) {
        // `mailto:` / `xmpp:` starting here, with a non-alphanumeric character
        // in front of it: the match ends in front of that character
        if (code === 109) {
          if (startsWithAt(src, i, 'mailto:')) return src.slice(0, i);
        } else if (startsWithAt(src, i, 'xmpp:')) {
          return src.slice(0, i);
        }
      }
    }
    i++;
  }

  if (i >= len) return src;
  if (i !== limit) return src;

  // `i` is an anchor: a construct starting here still wins, otherwise the match
  // ends right after the character in front of it.
  const code = src.charCodeAt(i);
  if (code < 128) {
    if (STOP[code] === 1) return src.slice(0, i);
    if (code === 104 || code === 72) {
      if (isHttpAt(src, i)) return src.slice(0, i);
    } else if (code === 102 || code === 70) {
      if (isFtpAt(src, i)) return src.slice(0, i);
    } else if (code === 119) {
      if (isWwwAt(src, i) && (i === 0 || isWwwBoundary(src.charCodeAt(i - 1)))) {
        return src.slice(0, i);
      }
    }
  }
  return src.slice(0, i + 1);
};
