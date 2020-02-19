## API Report File for "@edtr-io/plugin-image"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { BooleanStateType } from '@edtr-io/plugin';
import { DeepPartial } from '@edtr-io/ui';
import { EditorPlugin } from '@edtr-io/plugin';
import { EditorPluginProps } from '@edtr-io/plugin';
import { NumberStateType } from '@edtr-io/plugin';
import { ObjectStateType } from '@edtr-io/plugin';
import { OptionalStateType } from '@edtr-io/plugin';
import { StringStateType } from '@edtr-io/plugin';
import { UploadHandler } from '@edtr-io/plugin';
import { UploadStateType } from '@edtr-io/plugin';
import { UploadValidator } from '@edtr-io/plugin';

// @public (undocumented)
export function createImagePlugin(config: ImageConfig): EditorPlugin<ImagePluginState, ImagePluginConfig>;

// @public (undocumented)
export interface ImageConfig extends Omit<ImagePluginConfig, 'i18n'> {
    // (undocumented)
    i18n?: DeepPartial<ImagePluginConfig['i18n']>;
}

// @public (undocumented)
export interface ImagePluginConfig {
    // (undocumented)
    i18n: {
        label: string;
        failedUploadMessage: string;
        src: {
            label: string;
            placeholder: {
                empty: string;
                uploading: string;
                failed: string;
            };
            retryLabel: string;
        };
        link: {
            href: {
                label: string;
                placeholder: string;
            };
            openInNewTab: {
                label: string;
            };
        };
        alt: {
            label: string;
            placeholder: string;
        };
        maxWidth: {
            label: string;
            placeholder: string;
        };
    };
    // (undocumented)
    secondInput?: 'description' | 'link';
    // (undocumented)
    upload: UploadHandler<string>;
    // (undocumented)
    validate: UploadValidator;
}

// @public (undocumented)
export type ImagePluginState = ObjectStateType<{
    src: UploadStateType<string>;
    link: OptionalStateType<ObjectStateType<{
        href: StringStateType;
        openInNewTab: BooleanStateType;
    }>>;
    alt: OptionalStateType<StringStateType>;
    maxWidth: OptionalStateType<NumberStateType>;
}>;

// @public (undocumented)
export type ImageProps = EditorPluginProps<ImagePluginState, ImagePluginConfig>;


// (No @packageDocumentation comment for this package)

```