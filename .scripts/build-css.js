#!/usr/bin/env node

const { promisify } = require('util');
const { basename, dirname, format, relative, resolve } = require('path');
const fs = require('fs');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const ENC = 'utf-8';

const INLINE_REGEX = /(.*)\s*\/\/\s*inline\s*$/gimu;
const DEFER_REGEX = /(.*)\s*\/\/\s*link\s*$/gimu;
const INLINE_BLOCK_REGEX = /\/\/\s*>*\s*<{3,}\s*inline([\s\S]*?)\/\/\s*>{3,}.*/gimu;
const DEFER_BLOCK_REGEX = /\/\/\s*>*\s*<{3,}\s*link([\s\S]*?)\/\/\s*>{3,}.*/gimu;

function genHeader(filename) {
  return `// THIS FILE IS AUTOGENERATED, DO NOT MODIFY!
//
// To change the contents of this file,
// edit \`${filename}\`
// and run \`npm run build:css\`.
//
// During development you can run \`npm run watch:css\`
// to continuosly rebuild this file.
//
`;
}

// <https://stackoverflow.com/a/45130990/870615>
async function getFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(
    subdirs.map(async subdir => {
      const res = resolve(dir, subdir);
      return (await stat(res)).isDirectory() ? getFiles(res) : res;
    }),
  );
  return files.reduce((a, f) => a.concat(f), []);
}

(async function main() {
  try {
    const files = process.argv.length > 2 ? [process.argv[2]] : await getFiles('_sass');
    await Promise.all(
      files.filter(f => f.endsWith('.pre.scss')).map(async file => {
        const content = await readFile(file, ENC);
        const name = basename(file, '.pre.scss');
        const filename = format({ name, ext: '.scss' });
        const dir = dirname(file);

        const inline = content
          .replace(INLINE_REGEX, '$1')
          .replace(INLINE_BLOCK_REGEX, '$1')
          .replace(DEFER_REGEX, '// $1')
          .replace(DEFER_BLOCK_REGEX, '');

        const defer = content
          .replace(DEFER_REGEX, '$1')
          .replace(DEFER_BLOCK_REGEX, '$1')
          .replace(INLINE_REGEX, '// $1')
          .replace(INLINE_BLOCK_REGEX, '');

        const path = relative(resolve(), dirname(file));
        const header = genHeader([path, basename(file)].join('/'));

        return Promise.all([
          writeFile(resolve(dir, '__inline', filename), header + inline, ENC),
          writeFile(resolve(dir, '__link', filename), header + defer, ENC),
        ]);
      }),
    );
    process.exit(0);
  } catch (e) {
    console.error(e); // eslint-disable-line
    process.exit(1);
  }
})();
