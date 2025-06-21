import { Agent, getAgentByName } from 'agents';
import { generateText, streamText, experimental_transcribe as transcribe } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { google } from 'googleapis';
import { sheetsTools } from '../tools/sheets';
import { success } from 'zod/v4';

export class AudioTranscriptionAgent extends Agent<CloudflareBindings> {
	openai = createOpenAI({
		apiKey: this.env.OPENAI_API_KEY,
		baseURL: `https://gateway.ai.cloudflare.com/v1/tushar-personal/${this.env.CF_AI_GATEWAY_ID}/workers-ai/openai`,
		headers: {
			'cf-aig-authorization': `Bearer ${this.env.CF_TOKEN}`,
		},
	});
	async onRequest(request: Request): Promise<Response> {
		const formData = await request.formData();
		const audioFile = formData.get('audio') as File;
		const blob = await audioFile.arrayBuffer();

		console.log('Making call to transcribe text');
		const transcription = await transcribe({
			model: openai.transcription('whisper-1'),
			audio: blob,
		});
		// @ts-expect-error Take text from transcription
		const text = transcription.responses?.[0]?.body?.text || '';
		console.log('Text transcribed successfully with text:', text);

		console.log('Running sheets agent.');
		const agent = await getAgentByName(this.env['google-sheets-agent'], 'default');

		agent
			.processSheetRequest({ text })
			.then(() => {
				console.log('Sheets agent ran successfully.');
			})
			.catch((e) => {
				console.error('error calling the sheets agent', e);
			});

		return Response.json({ success: true });
	}
}

export class GoogleSheetsAgent extends Agent<CloudflareBindings> {
	openai = createOpenAI({
		apiKey: this.env.OPENAI_API_KEY,
		baseURL: `https://gateway.ai.cloudflare.com/v1/tushar-personal/${this.env.CF_AI_GATEWAY_ID}/workers-ai/openai`,
		headers: {
			'cf-aig-authorization': `Bearer ${this.env.CF_TOKEN}`,
		},
	});
	auth = new google.auth.GoogleAuth({
		apiKey: this.env.GOOGLE_SHEET_API_KEY,
	});
	sheets = google.sheets({ version: 'v4', auth: this.auth });
	async processSheetRequest({ text }: { text: string }) {
		console.log('Processing sheet request with text:', text);
		const respText = await generateText({
			model: openai.chat('gpt-4.1'),
			messages: [
				{
					role: 'system',
					content:
						'You are a assistant that manages Google Sheets using different tool. Figure out what the user wants to do with the sheet and then execute the appropriate tool.',
				},
				{
					role: 'user',
					content: text,
				},
			],
			tools: sheetsTools(this.sheets),
			maxSteps: 5,
		});
		console.log('Sheet request processed successfully.', respText);

		return respText.text;
	}

	// Keep the old method for backward compatibility but redirect to the new one
	async updateSheet({ text }: { text: string }) {
		return this.processSheetRequest({ text });
	}
}
