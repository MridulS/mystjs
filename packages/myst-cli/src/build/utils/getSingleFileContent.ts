import { resolve } from 'path';
import type { LinkTransformer } from 'myst-transforms';
import type { ISession } from '../../session/types';
import {
  loadFile,
  selectFile,
  postProcessMdast,
  transformMdast,
  processProject,
} from '../../process';
import { reduceOutputs } from '../../transforms';
import type { ImageExtensions } from '../../utils';

export async function getSingleFileContent(
  session: ISession,
  file: string,
  imageWriteFolder: string,
  {
    projectPath,
    imageAltOutputFolder,
    imageExtensions,
    extraLinkTransformers,
  }: {
    projectPath?: string;
    imageAltOutputFolder?: string;
    imageExtensions?: ImageExtensions[];
    extraLinkTransformers?: LinkTransformer[];
  },
) {
  file = resolve(file);
  await processProject(
    session,
    { path: projectPath ?? resolve('.') },
    {
      writeFiles: false,
      imageWriteFolder,
      imageAltOutputFolder,
      imageExtensions,
      extraLinkTransformers,
      minifyMaxCharacters: 0,
    },
  );
  let selectedFile = selectFile(session, file);
  if (!selectedFile) {
    await loadFile(session, file, undefined, { minifyMaxCharacters: 0 });
    // Collect bib files - myst-to-tex will need those, not 'references'
    await transformMdast(session, {
      file,
      imageWriteFolder: imageWriteFolder,
      imageAltOutputFolder: imageAltOutputFolder ?? undefined,
      imageExtensions,
      projectPath,
      minifyMaxCharacters: 0,
    });
    await postProcessMdast(session, { file, extraLinkTransformers });
  }
  selectedFile = selectFile(session, file);
  if (!selectedFile) throw new Error(`Could not load file information for ${file}`);
  // Transform output nodes to images / text
  reduceOutputs(selectedFile.mdast, imageWriteFolder);
  return selectedFile;
}
