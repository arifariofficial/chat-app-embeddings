import { PGChunk, PGEssay, PGJson } from "@/types";
import axios from "axios";
import * as cheerio from "cheerio";
import { encode } from "gpt-3-encoder";
import fs from "fs";

const BASE_URL = "https://www.paulgraham.com/";
const CHUNK_SIZE = 200;

// Fetch the list of article links from the main articles page
async function getLinks(): Promise<{ url: string; title: string }[]> {
	try {
		const html = await axios.get(`${BASE_URL}/articles.html`);

		const $ = cheerio.load(html.data);
		const tables = $("table");
		const linkArr: { url: string; title: string }[] = [];

		tables.each((i, table) => {
			if (i === 2) {
				const links = $(table).find("a");
				links.each((_, link) => {
					const url = $(link).attr("href");
					const title = $(link).text().trim();

					if (url && url.endsWith(".html")) {
						linkArr.push({ url, title });
					}
				});
			}
		});

		return linkArr;
	} catch (error) {
		console.error("Error fetching links:", error);
		throw error;
	}
}

// Fetch and parse an individual essay
async function getEssay(linkObj: { url: string; title: string }): Promise<PGEssay> {
	const { title, url } = linkObj;
	const fullLink = BASE_URL + url;

	try {
		const html = await axios.get(fullLink);

		const $ = cheerio.load(html.data);
		const tables = $("table");

		let essayText = "";
		let dateStr = "";
		let thanksTo = "";

		tables.each((i, table) => {
			if (i === 1) {
				const text = $(table).text().trim();

				// Clean up and extract date
				let cleanedText = text.replace(/\s+/g, " ").replace(/\.([a-zA-Z])/g, ". $1");
				const dateMatch = cleanedText.match(/([A-Z][a-z]+ [0-9]{4})/);
				if (dateMatch) {
					dateStr = dateMatch[0];
					essayText = cleanedText.replace(dateStr, "").trim();
				}

				// Extract 'Thanks to' section if present
				const splitText = essayText.split(". ").filter(Boolean);
				const lastSentence = splitText[splitText.length - 1];
				if (lastSentence && lastSentence.includes("Thanks to")) {
					thanksTo = "Thanks to " + lastSentence.split("Thanks to")[1].trim() + ".";
					essayText = essayText.replace(thanksTo, "").trim();
				}
			}
		});

		return {
			title,
			url: fullLink,
			date: dateStr,
			thanks: thanksTo.trim(),
			content: essayText,
			length: essayText.length,
			tokens: encode(essayText).length,
			chunks: [],
		};
	} catch (error) {
		console.error(`Error fetching essay from ${fullLink}:`, error);
		throw error;
	}
}

// Chunk the essay content into manageable pieces
async function chunkEssay(essay: PGEssay): Promise<PGEssay> {
	const { title, content } = essay;

	const chunks: PGChunk[] = [];
	if (encode(content).length > CHUNK_SIZE) {
		const split = content.split(". ");
		let chunkText = "";

		for (const sentence of split) {
			const sentenceTokenLength = encode(sentence).length;
			const chunkTextTokenLength = encode(chunkText).length;

			if (chunkTextTokenLength + sentenceTokenLength > CHUNK_SIZE) {
				chunks.push(createChunk(essay, chunkText));

				chunkText = "";
			}
			chunkText += sentence + (sentence.endsWith(".") ? " " : ". ");
		}
		chunks.push(createChunk(essay, chunkText.trim()));
	} else {
		chunks.push(createChunk(essay, content.trim()));
	}

	// Merge small chunks
	const mergedChunks = mergeSmallChunks(chunks);

	return { ...essay, chunks: mergedChunks };
}

// Helper function to create a chunk
function createChunk(essay: PGEssay, content: string): PGChunk {
	const { title, url, date, thanks } = essay;
	const chunk = {
		essay_title: title,
		essay_url: url,
		essay_date: date,
		essay_thanks: thanks,
		content: content,
		content_length: content.length,
		content_tokens: encode(content).length,
		embedding: [],
	};
	return chunk;
}

// Helper function to merge small chunks
function mergeSmallChunks(chunks: PGChunk[]): PGChunk[] {
	const result: PGChunk[] = [];

	for (let i = 0; i < chunks.length; i++) {
		const currentChunk = chunks[i];
		const prevChunk = result[result.length - 1];

		if (currentChunk.content_tokens < 100 && prevChunk) {
			prevChunk.content += " " + currentChunk.content;
			prevChunk.content_length += currentChunk.content_length;
			prevChunk.content_tokens += currentChunk.content_tokens;
		} else {
			result.push(currentChunk);
		}
	}

	return result;
}

// Main function to orchestrate the data processing
(async () => {
	try {
		console.log("Starting the essay processing script...");
		const links = await getLinks();
		const essays: PGEssay[] = [];

		for (const link of links) {
			console.log("Processing: ", link.title, " at ", BASE_URL + link.url);
			const essay = await getEssay(link);
			const chunkedEssay = await chunkEssay(essay);
			essays.push(chunkedEssay);
		}

		const json: PGJson = {
			current_date: new Date().toISOString().split("T")[0],
			author: "Paul Graham",
			url: "http://www.paulgraham.com/articles.html",
			length: essays.reduce((acc, essay) => acc + essay.length, 0),
			tokens: essays.reduce((acc, essay) => acc + essay.tokens, 0),
			essays,
		};

		fs.writeFileSync("scripts/pg.json", JSON.stringify(json, null, 2));
		console.log("Data successfully written to pg.json");
	} catch (error) {
		console.error("Error processing essays:", error);
	}
})();
