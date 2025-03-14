import { mystParse } from '../src';

describe('Parses colonFences', () => {
  test('colon fences parse', () => {
    const mdast = mystParse(`:::{tip}\nThis is a tip in a fence!\n:::`);
    expect(mdast.children[0].type).toBe('mystDirective');
    expect((mdast.children[0] as any).name).toBe('tip');
  });
  test('colon fence as a fence', () => {
    const mdast = mystParse(`:::md\nThis is code!\n:::`);
    expect(mdast.children[0].type).toBe('code');
    expect((mdast.children[0] as any).lang).toBe('md');
    expect((mdast.children[0] as any).value).toBe('This is code!');
  });
});
