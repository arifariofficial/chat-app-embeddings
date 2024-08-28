import axios from "axios";

const BASE_URL = "https://www.paulgraham.com";

async function getLInks() {
	const html = await axios.get(`${BASE_URL}/articles.html`);
}

async () => {};
