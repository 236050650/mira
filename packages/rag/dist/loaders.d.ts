import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
export type LoaderMetadata = Record<string, unknown>;
export declare class TextDocumentLoader extends BaseDocumentLoader {
    private readonly source;
    constructor(source: string | {
        text: string;
        metadata?: LoaderMetadata;
    });
    load(): Promise<Document[]>;
}
export declare class MarkdownDocumentLoader extends BaseDocumentLoader {
    private readonly filePath;
    private readonly metadata;
    constructor(filePath: string, metadata?: LoaderMetadata);
    load(): Promise<Document[]>;
}
export declare class PlainTextFileLoader extends BaseDocumentLoader {
    private readonly filePath;
    private readonly metadata;
    constructor(filePath: string, metadata?: LoaderMetadata);
    load(): Promise<Document[]>;
}
export declare function splitDocumentsWithLangChain(documents: Document[], options?: {
    chunkSize?: number;
    chunkOverlap?: number;
}): Promise<Document[]>;
export declare function loadAndSplitText(text: string, metadata?: LoaderMetadata, options?: {
    chunkSize?: number;
    chunkOverlap?: number;
}): Promise<Document[]>;
//# sourceMappingURL=loaders.d.ts.map