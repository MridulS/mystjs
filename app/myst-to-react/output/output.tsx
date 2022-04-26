import type { GenericNode } from 'mystjs';
import { KnownCellOutputMimeTypes } from '@curvenote/blocks/dist/blocks/types/jupyter';
import { MinifiedMimeOutput, MinifiedOutput } from '@curvenote/nbtx/dist/minify/types';
import classNames from 'classnames';
import { SafeOutputs } from './safe';
import { NativeJupyterOutputs as JupyterOutputs } from './jupyter';
import { OutputBlock } from './outputBlock';

const DIRECT_OUTPUT_TYPES = new Set([]);

const DIRECT_MIME_TYPES = new Set([
  KnownCellOutputMimeTypes.ImagePng,
  KnownCellOutputMimeTypes.ImageGif,
  KnownCellOutputMimeTypes.ImageJpeg,
  KnownCellOutputMimeTypes.ImageBmp,
]) as Set<string>;

function anImageAndPlainTextOnly(directMimeTypes: Set<string>, mimetypes: string[]) {
  return (
    mimetypes.length === 2 &&
    mimetypes.includes('text/plain') &&
    mimetypes.reduce(
      (flag: boolean, mt: string) => flag || directMimeTypes.has(mt),
      false,
    )
  );
}

export function allOutputsAreSafe(
  outputs: MinifiedOutput[],
  directOutputTypes: Set<string>,
  directMimeTypes: Set<string>,
) {
  return outputs.reduce((flag, output) => {
    if (directOutputTypes.has(output.output_type)) return true;
    const data = (output as MinifiedMimeOutput).data;
    const mimetypes = data ? Object.keys(data) : [];
    const safe =
      'data' in output &&
      Boolean(output.data) &&
      (mimetypes.every((mimetype) => directMimeTypes.has(mimetype)) ||
        anImageAndPlainTextOnly(directMimeTypes, mimetypes));
    return flag && safe;
  }, true);
}

export function anyErrors(outputs: MinifiedOutput[]) {
  return outputs.reduce(
    (flag, output) => flag || output.output_type === 'error',
    false,
  );
}

export function Output(node: GenericNode) {
  const outputs: MinifiedOutput[] = node.data;
  const allSafe = allOutputsAreSafe(outputs, DIRECT_OUTPUT_TYPES, DIRECT_MIME_TYPES);
  const hasError = anyErrors(outputs);

  let component;
  if (allSafe) {
    component = <SafeOutputs keyStub={node.key} outputs={outputs} />;
  } else {
    component = <JupyterOutputs id={node.key} outputs={outputs} />;
  }
  console.log({ allSafe });

  return (
    <figure
      suppressHydrationWarning={!allSafe}
      key={node.key}
      id={node.identifier || undefined}
      className={classNames('max-w-full overflow-auto m-0', {
        'text-left': !node.align || node.align === 'left',
        'text-center': node.align === 'center',
        'text-right': node.align === 'right',
      })}
    >
      <OutputBlock allSafe={allSafe} hasError={hasError}>
        {component}
      </OutputBlock>
    </figure>
  );
}
