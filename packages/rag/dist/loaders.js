import { readFile } from "node:fs/promises";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CHINESE_SEPARATORS } from "./split-constants.js";
export class TextDocumentLoader extends BaseDocumentLoader {
    source;
    constructor(source) {
        super();
        this.source = source;
    }
    async load() {
        const text = typeof this.source === "string" ? this.source : this.source.text;
        const metadata = typeof this.source === "string" ? {} : (this.source.metadata ?? {});
        return [new Document({ pageContent: text, metadata })];
    }
}
export class MarkdownDocumentLoader extends BaseDocumentLoader {
    filePath;
    metadata;
    constructor(filePath, metadata = {}) {
        super();
        this.filePath = filePath;
        this.metadata = metadata;
    }
    async load() {
        const text = await readFile(this.filePath, "utf8");
        return [
            new Document({
                pageContent: text,
                metadata: { ...this.metadata, source: this.filePath, format: "markdown" },
            }),
        ];
    }
}
export class PlainTextFileLoader extends BaseDocumentLoader {
    filePath;
    metadata;
    constructor(filePath, metadata = {}) {
        super();
        this.filePath = filePath;
        this.metadata = metadata;
    }
    async load() {
        const text = await readFile(this.filePath, "utf8");
        return [
            new Document({
                pageContent: text,
                metadata: { ...this.metadata, source: this.filePath, format: "text" },
            }),
        ];
    }
}
export async function splitDocumentsWithLangChain(documents, options) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: options?.chunkSize ?? 400,
        chunkOverlap: options?.chunkOverlap ?? 40,
        separators: CHINESE_SEPARATORS,
    });
    return splitter.splitDocuments(documents);
}
export async function loadAndSplitText(text, metadata = {}, options) {
    const loader = new TextDocumentLoader({ text, metadata });
    const docs = await loader.load();
    return splitDocumentsWithLangChain(docs, options);
}
//# sourceMappingURL=loaders.js.map