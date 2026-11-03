import { readFile } from "node:fs/promises";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CHINESE_SEPARATORS } from "./split-constants.js";

export type LoaderMetadata = Record<string, unknown>;

export class TextDocumentLoader extends BaseDocumentLoader {
  constructor(
    private readonly source: string | { text: string; metadata?: LoaderMetadata },
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    const text = typeof this.source === "string" ? this.source : this.source.text;
    const metadata = typeof this.source === "string" ? {} : (this.source.metadata ?? {});
    return [new Document({ pageContent: text, metadata })];
  }
}

export class MarkdownDocumentLoader extends BaseDocumentLoader {
  constructor(
    private readonly filePath: string,
    private readonly metadata: LoaderMetadata = {},
  ) {
    super();
  }

  async load(): Promise<Document[]> {
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
  constructor(
    private readonly filePath: string,
    private readonly metadata: LoaderMetadata = {},
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    const text = await readFile(this.filePath, "utf8");
    return [
      new Document({
        pageContent: text,
        metadata: { ...this.metadata, source: this.filePath, format: "text" },
      }),
    ];
  }
}

export async function splitDocumentsWithLangChain(
  documents: Document[],
  options?: { chunkSize?: number; chunkOverlap?: number },
): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options?.chunkSize ?? 400,
    chunkOverlap: options?.chunkOverlap ?? 40,
    separators: CHINESE_SEPARATORS,
  });
  return splitter.splitDocuments(documents);
}

export async function loadAndSplitText(
  text: string,
  metadata: LoaderMetadata = {},
  options?: { chunkSize?: number; chunkOverlap?: number },
): Promise<Document[]> {
  const loader = new TextDocumentLoader({ text, metadata });
  const docs = await loader.load();
  return splitDocumentsWithLangChain(docs, options);
}
