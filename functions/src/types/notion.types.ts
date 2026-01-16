/**
 * Notion API Types
 * @see https://developers.notion.com/reference/intro
 */

export interface NotionPageCreateRequest {
    parent: {
        database_id: string;
    };
    properties: NotionProperties;
    children?: NotionBlock[];
}

export type NotionProperties = Record<string, NotionPropertyValue>;

export type NotionPropertyValue =
    | NotionTitleProperty
    | NotionRichTextProperty
    | NotionSelectProperty
    | NotionMultiSelectProperty
    | NotionDateProperty
    | NotionStatusProperty
    | NotionNumberProperty
    | NotionCheckboxProperty
    | NotionUrlProperty
    | NotionEmailProperty
    | NotionFilesProperty;

export interface NotionTitleProperty {
    title: NotionRichTextItem[];
}

export interface NotionRichTextProperty {
    rich_text: NotionRichTextItem[];
}

export interface NotionRichTextItem {
    type?: 'text';
    text: {
        content: string;
        link?: { url: string } | null;
    };
    annotations?: NotionAnnotations;
}

export interface NotionAnnotations {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
}

export interface NotionSelectProperty {
    select: {
        name: string;
    } | null;
}

export interface NotionMultiSelectProperty {
    multi_select: Array<{
        name: string;
    }>;
}

export interface NotionDateProperty {
    date: {
        start: string;
        end?: string | null;
        time_zone?: string | null;
    } | null;
}

export interface NotionStatusProperty {
    status: {
        name: string;
    } | null;
}

export interface NotionNumberProperty {
    number: number | null;
}

export interface NotionCheckboxProperty {
    checkbox: boolean;
}

export interface NotionUrlProperty {
    url: string | null;
}

export interface NotionEmailProperty {
    email: string | null;
}

export interface NotionFilesProperty {
    files: Array<{
        type: 'external' | 'file';
        name: string;
        external?: { url: string };
        file?: { url: string; expiry_time: string };
    }>;
}

export type NotionBlock = NotionParagraphBlock | NotionHeadingBlock;

export interface NotionParagraphBlock {
    object: 'block';
    type: 'paragraph';
    paragraph: {
        rich_text: NotionRichTextItem[];
    };
}

export interface NotionHeadingBlock {
    object: 'block';
    type: 'heading_1' | 'heading_2' | 'heading_3';
    heading_1?: { rich_text: NotionRichTextItem[] };
    heading_2?: { rich_text: NotionRichTextItem[] };
    heading_3?: { rich_text: NotionRichTextItem[] };
}

// Database schema types
export interface NotionDatabaseSchema {
    [propertyName: string]: NotionDatabaseProperty;
}

export interface NotionDatabaseProperty {
    id: string;
    name: string;
    type: NotionPropertyType;
    title?: Record<string, never>;
    rich_text?: Record<string, never>;
    select?: {
        options: Array<{ id: string; name: string; color: string }>;
    };
    multi_select?: {
        options: Array<{ id: string; name: string; color: string }>;
    };
    status?: {
        options: Array<{ id: string; name: string; color: string }>;
        groups: Array<{ id: string; name: string; option_ids: string[] }>;
    };
    date?: Record<string, never>;
    number?: { format: string };
    checkbox?: Record<string, never>;
    url?: Record<string, never>;
    email?: Record<string, never>;
}

export type NotionPropertyType =
    | 'title'
    | 'rich_text'
    | 'select'
    | 'multi_select'
    | 'status'
    | 'date'
    | 'number'
    | 'checkbox'
    | 'url'
    | 'email'
    | 'phone_number'
    | 'formula'
    | 'relation'
    | 'rollup'
    | 'created_time'
    | 'created_by'
    | 'last_edited_time'
    | 'last_edited_by'
    | 'files'
    | 'people';

// API Response types
export interface NotionPageResponse {
    id: string;
    created_time: string;
    last_edited_time: string;
    url: string;
    properties: NotionProperties;
}

export interface NotionDatabaseResponse {
    id: string;
    title: NotionRichTextItem[];
    properties: NotionDatabaseSchema;
}

export interface NotionError {
    object: 'error';
    status: number;
    code: string;
    message: string;
}
