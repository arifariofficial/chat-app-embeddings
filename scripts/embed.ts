import fs from "fs";
import { PGEssay, PGJson } from "@/types";
import { loadEnvConfig } from "@next/env";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig("");

async function generateEmbeddings(essays: PGEssay[]) {
	const openai = new OpenAI();

	const supabase = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);

	for (let i = 0; i < essays.length; i++) {
		const essay = essays[i];

		for (let j = 0; j < essay.chunks.length; j++) {
			const chunk = essay.chunks[j];

			console.log("Chunk Content:", chunk.content); // Debugging line

			// Ensure the content is a string
			if (typeof chunk.content !== "string") {
				console.error(`Invalid content at essay index ${i}, chunk index ${j}`);
				continue; // Skip this chunk
			}

			const embeddingResponse = await openai.embeddings.create({
				model: "text-embedding-ada-002",
				input: [chunk.content],
			});

			const [{ embedding }] = embeddingResponse.data;

			const { data, error } = await supabase
				.from("pual_graham")
				.insert({
					essay_title: chunk.essay_title,
					essay_url: chunk.essay_url,
					essay_date: chunk.essay_date,
					content: chunk.content,
					content_tokens: chunk.content_tokens,
					embedding: embedding,
				})
				.select("*");
			if (error) {
				console.log("error: ", error.message);
			} else {
				console.log("saved", i, j);
			}

			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
}

(async () => {
	const book: PGJson = JSON.parse(fs.readFileSync("scripts/pg.json", "utf8"));

	await generateEmbeddings(book.essays);
})();
