import { convertPlaceholders, looksLikeTldr, parseTldr } from '../tldr';
import { extractVariables } from '../../template';

const PAGE = `# tar

> Archiving utility.
> Often combined with a compression method, such as \`gzip\` or \`bzip2\`.
> More information: <https://www.gnu.org/software/tar>.

- Create an archive and write it to a file:

\`tar cf {{path/to/target.tar}} {{path/to/file1 path/to/file2 ...}}\`

- Extract an archive to a given directory:

\`tar xf {{path/to/source.tar}} {{[-C|--directory]}} {{path/to/directory}}\`

- Extract an archive to a given directory:

\`tar xf {{path/to/other.tar}}\`
`;

describe('tldr parser', () => {
  it('detects tldr pages', () => {
    expect(looksLikeTldr(PAGE)).toBe(true);
    expect(looksLikeTldr('just some text')).toBe(false);
    expect(looksLikeTldr('{"name":"x"}')).toBe(false);
  });

  it('parses examples into command items with identifier variables', () => {
    const pack = parseTldr(PAGE);
    expect(pack).toMatchObject({ name: 'tldr: tar', category: 'tldr pages', pinned: false });
    expect(pack.items).toHaveLength(3);
    expect(pack.items[0]).toMatchObject({
      title: 'tar: Create an archive and write it to a file',
      type: 'command',
      language: 'bash',
      tags: ['tar'],
    });
    expect(pack.items[0].description).toBe('Archiving utility. Often combined with a compression method, such as `gzip` or `bzip2`.');
    expect(pack.items[0].body).toBe('tar cf {{path_to_target_tar}} {{path_to_file1_path_to_file2}}');
    expect(extractVariables(pack.items[0].body)).toEqual(['path_to_target_tar', 'path_to_file1_path_to_file2']);
    expect(pack.items[1].body).toBe('tar xf {{path_to_source_tar}} -C {{path_to_directory}}');
  });

  it('makes duplicate example titles unique', () => {
    const titles = parseTldr(PAGE).items.map((i) => i.title);
    expect(new Set(titles).size).toBe(3);
    expect(titles[2]).toBe('tar: Extract an archive to a given directory (2)');
  });

  it('gives a stable version for identical content and a new one when it changes', () => {
    expect(parseTldr(PAGE).version).toBe(parseTldr(PAGE).version);
    expect(parseTldr(PAGE + '\n- New:\n\n`tar --new`\n').version).not.toBe(parseTldr(PAGE).version);
  });

  it('throws on pages without examples or heading', () => {
    expect(() => parseTldr('# empty\n\n> nothing')).toThrow(/No examples/);
    expect(() => parseTldr('no heading')).toThrow(/does not look like/);
  });

  it('converts odd placeholders safely', () => {
    expect(convertPlaceholders('x {{1st}} {{...}} {{a-b.c}}')).toBe('x {{_1st}} {{value}} {{a_b_c}}');
  });
});
