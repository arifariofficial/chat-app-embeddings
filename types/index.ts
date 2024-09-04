export enum OpenAIModel {
	DAVINCI_TURBO = "gpt-3.5-turbo",
}

export type PGEssay = {
	title: string; // Any string value
	url: string;
	date: string;
	thanks: string;
	content: string;
	length: number; // Any number value
	tokens: number;
	chunks: PGChunk[];
};

export type PGChunk = {
	essay_title: string;
	essay_url: string;
	essay_date: string;
	essay_thanks: string;
	content: string;
	content_length: number;
	content_tokens: number;
	embedding: number[];
};

export type PGJson = {
	current_date: string;
	author: string;
	url: string;
	length: number;
	tokens: number;
	essays: PGEssay[];
};
