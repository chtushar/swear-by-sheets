import { z } from 'zod';
import { tool } from 'ai';
import { sheets_v4, drive_v3 } from 'googleapis';

// Export all tools as a collection
export const sheetsTools = (sheets: sheets_v4.Sheets, drive: drive_v3.Drive) => {
	const createSpreadsheet = tool({
		description: 'Create a new Google spreadsheet - use this ONLY when the user wants to create a brand new spreadsheet from scratch',
		parameters: z.object({
			title: z.string().min(1).describe('Title of the spreadsheet'),
			sheets: z
				.array(
					z.object({
						title: z.string().min(1).describe('Title of the sheet'),
						rows: z.number().int().positive().optional().default(1000),
						columns: z.number().int().positive().optional().default(26),
					}),
				)
				.optional()
				.describe('Initial sheets to create'),
		}),
		execute: async ({ title, sheets: requestedSheets }) => {
			console.log('TOOL CALLED: createSpreadsheet');
			console.log('Creating spreadsheet:', { title, sheets: requestedSheets });

			try {
				const response = await sheets.spreadsheets.create({
					requestBody: {
						properties: {
							title,
						},
						sheets: requestedSheets?.map((sheet) => ({
							properties: {
								title: sheet.title,
								gridProperties: {
									rowCount: sheet.rows,
									columnCount: sheet.columns,
								},
							},
						})),
					},
				});

				return {
					spreadsheetId: response.data.spreadsheetId!,
					spreadsheetUrl: response.data.spreadsheetUrl!,
					sheets:
						response.data.sheets?.map((sheet) => ({
							title: sheet.properties?.title || 'Sheet1',
							rows: sheet.properties?.gridProperties?.rowCount || 1000,
							columns: sheet.properties?.gridProperties?.columnCount || 26,
						})) || [],
				};
			} catch (error) {
				console.error('Error creating spreadsheet:', error);
				throw new Error(`Failed to create spreadsheet: ${error}`);
			}
		},
	});

	const getValues = tool({
		description:
			'Get/read/view values from a Google spreadsheet - use this ONLY when the user wants to see, read, or retrieve existing data',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to retrieve values from'),
			range: z.string().describe('A1 notation range, e.g. "Sheet1!A1:D5"'),
			valueRenderOption: z
				.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
				.optional()
				.default('FORMATTED_VALUE')
				.describe('How to render the values'),
		}),
		execute: async ({ spreadsheetId, range, valueRenderOption }) => {
			console.log('TOOL CALLED: getValues');
			console.log('Getting values:', { spreadsheetId, range, valueRenderOption });

			try {
				const response = await sheets.spreadsheets.values.get({
					spreadsheetId,
					range,
					valueRenderOption,
				});

				return {
					range: response.data.range!,
					majorDimension: response.data.majorDimension || 'ROWS',
					values: response.data.values || [],
				};
			} catch (error) {
				console.error('Error getting values:', error);
				throw new Error(`Failed to get values: ${error}`);
			}
		},
	});

	const addSheet = tool({
		description:
			'Add a new sheet/tab to an existing spreadsheet - use this ONLY when the user wants to add a new worksheet/tab to an existing spreadsheet',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to update'),
			title: z.string().min(1).describe('Title of the new sheet'),
			rows: z.number().int().positive().optional().default(1000).describe('Number of rows'),
			columns: z.number().int().positive().optional().default(26).describe('Number of columns'),
		}),
		execute: async ({ spreadsheetId, title, rows, columns }) => {
			console.log('TOOL CALLED: addSheet');
			console.log('Adding sheet:', { spreadsheetId, title, rows, columns });

			try {
				const response = await sheets.spreadsheets.batchUpdate({
					spreadsheetId,
					requestBody: {
						requests: [
							{
								addSheet: {
									properties: {
										title,
										gridProperties: {
											rowCount: rows,
											columnCount: columns,
										},
									},
								},
							},
						],
					},
				});

				const addedSheet = response.data.replies?.[0]?.addSheet?.properties;
				if (!addedSheet) {
					throw new Error('No sheet was added in the response');
				}

				return {
					sheetId: addedSheet.sheetId!,
					title: addedSheet.title!,
					index: addedSheet.index!,
					sheetType: addedSheet.sheetType || 'GRID',
					gridProperties: {
						rowCount: addedSheet.gridProperties?.rowCount || rows,
						columnCount: addedSheet.gridProperties?.columnCount || columns,
					},
				};
			} catch (error) {
				console.error('Error adding sheet:', error);
				throw new Error(`Failed to add sheet: ${error}`);
			}
		},
	});

	const listSpreadsheets = tool({
		description: 'List/show all Google spreadsheets - use this ONLY when the user wants to see a list of their spreadsheets',
		parameters: z.object({
			maxResults: z.number().int().positive().optional().default(10).describe('Maximum number of spreadsheets to return'),
			query: z.string().optional().describe('Search query to filter spreadsheets'),
			nextPageToken: z.string().optional().describe('Token for pagination'),
		}),
		execute: async ({ maxResults, query, nextPageToken }) => {
			console.log('TOOL CALLED: listSpreadsheets');
			console.log('Listing spreadsheets:', { maxResults, query, nextPageToken });

			try {
				// Build the search query - filter for Google Sheets files
				let q = "mimeType='application/vnd.google-apps.spreadsheet'";
				if (query) {
					q += ` and name contains '${query}'`;
				}

				const response = await drive.files.list({
					q,
					pageSize: maxResults,
					pageToken: nextPageToken,
					fields: 'nextPageToken, files(id, name, createdTime, modifiedTime, webViewLink)',
				});

				return {
					files:
						response.data.files?.map((file) => ({
							id: file.id!,
							name: file.name!,
							createdTime: file.createdTime,
							modifiedTime: file.modifiedTime,
							webViewLink: file.webViewLink,
						})) || [],
					nextPageToken: response.data.nextPageToken || null,
				};
			} catch (error) {
				console.error('Error listing spreadsheets:', error);
				throw new Error(`Failed to list spreadsheets: ${error}`);
			}
		},
	});

	const getSpreadsheet = tool({
		description:
			'Get metadata/information about a Google spreadsheet - use this ONLY when the user wants spreadsheet properties, not cell values',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to retrieve'),
		}),
		execute: async ({ spreadsheetId }) => {
			console.log('TOOL CALLED: getSpreadsheet');
			console.log('Getting spreadsheet metadata:', { spreadsheetId });

			try {
				const response = await sheets.spreadsheets.get({
					spreadsheetId,
				});

				return {
					spreadsheetId: response.data.spreadsheetId!,
					properties: {
						title: response.data.properties?.title || '',
						locale: response.data.properties?.locale || 'en_US',
						timeZone: response.data.properties?.timeZone || 'America/New_York',
					},
					sheets:
						response.data.sheets?.map((sheet) => ({
							sheetId: sheet.properties?.sheetId,
							title: sheet.properties?.title || '',
							index: sheet.properties?.index || 0,
							sheetType: sheet.properties?.sheetType || 'GRID',
							gridProperties: sheet.properties?.gridProperties,
						})) || [],
					spreadsheetUrl: response.data.spreadsheetUrl!,
				};
			} catch (error) {
				console.error('Error getting spreadsheet metadata:', error);
				throw new Error(`Failed to get spreadsheet metadata: ${error}`);
			}
		},
	});

	const deleteSpreadsheet = tool({
		description: 'Delete an entire Google spreadsheet - use this ONLY when the user wants to permanently delete a whole spreadsheet',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to delete'),
		}),
		execute: async ({ spreadsheetId }) => {
			console.log('TOOL CALLED: deleteSpreadsheet');
			console.log('Deleting spreadsheet:', { spreadsheetId });

			try {
				await drive.files.delete({
					fileId: spreadsheetId,
				});

				return {
					success: true,
					spreadsheetId,
				};
			} catch (error) {
				console.error('Error deleting spreadsheet:', error);
				throw new Error(`Failed to delete spreadsheet: ${error}`);
			}
		},
	});

	const updateValues = tool({
		description:
			'Update/write/change values in a Google spreadsheet - use this ONLY when the user wants to write, modify, or change cell values',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to update'),
			range: z.string().describe('A1 notation range, e.g. "Sheet1!A1:D5"'),
			values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('Array of arrays with values to update'),
			valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional().default('USER_ENTERED').describe('How to interpret the values'),
		}),
		execute: async ({ spreadsheetId, range, values, valueInputOption }) => {
			console.log('TOOL CALLED: updateValues');
			console.log('Updating values:', { spreadsheetId, range, values, valueInputOption });

			try {
				const response = await sheets.spreadsheets.values.update({
					spreadsheetId,
					range,
					valueInputOption,
					requestBody: {
						values,
					},
				});

				return {
					spreadsheetId: response.data.spreadsheetId!,
					updatedRange: response.data.updatedRange!,
					updatedRows: response.data.updatedRows || 0,
					updatedColumns: response.data.updatedColumns || 0,
					updatedCells: response.data.updatedCells || 0,
				};
			} catch (error) {
				console.error('Error updating values:', error);
				throw new Error(`Failed to update values: ${error}`);
			}
		},
	});

	const deleteSheet = tool({
		description:
			'Delete a sheet/tab from a spreadsheet - use this ONLY when the user wants to remove a specific worksheet/tab, not the entire spreadsheet',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			sheetId: z.number().int().describe('The ID of the sheet to delete (not the name)'),
		}),
		execute: async ({ spreadsheetId, sheetId }) => {
			console.log('TOOL CALLED: deleteSheet');
			console.log('Deleting sheet:', { spreadsheetId, sheetId });

			try {
				await sheets.spreadsheets.batchUpdate({
					spreadsheetId,
					requestBody: {
						requests: [
							{
								deleteSheet: {
									sheetId,
								},
							},
						],
					},
				});

				return {
					success: true,
					spreadsheetId,
					deletedSheetId: sheetId,
				};
			} catch (error) {
				console.error('Error deleting sheet:', error);
				throw new Error(`Failed to delete sheet: ${error}`);
			}
		},
	});

	const shareSpreadsheet = tool({
		description: 'Share a Google spreadsheet with others - use this ONLY when the user wants to grant access or permissions to other users',
		parameters: z
			.object({
				spreadsheetId: z.string().describe('ID of the spreadsheet to share'),
				emailAddress: z.string().email().optional().describe('Email address of the user to share with'),
				domain: z.string().optional().describe('Domain to share with (instead of specific email)'),
				role: z.enum(['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader']).describe('Role to grant to the user'),
				sendNotification: z.boolean().optional().default(true).describe('Whether to send a notification email'),
			})
			.refine((data) => data.emailAddress || data.domain, {
				message: 'Either emailAddress or domain must be provided',
			}),
		execute: async ({ spreadsheetId, emailAddress, domain, role, sendNotification }) => {
			console.log('TOOL CALLED: shareSpreadsheet');
			console.log('Sharing spreadsheet:', { spreadsheetId, emailAddress, domain, role, sendNotification });

			try {
				const permission: any = {
					type: emailAddress ? 'user' : 'domain',
					role,
				};

				if (emailAddress) {
					permission.emailAddress = emailAddress;
				} else if (domain) {
					permission.domain = domain;
				}

				const response = await drive.permissions.create({
					fileId: spreadsheetId,
					requestBody: permission,
					sendNotificationEmail: sendNotification,
				});

				return {
					id: response.data.id!,
					type: response.data.type!,
					emailAddress: response.data.emailAddress,
					domain: response.data.domain,
					role: response.data.role!,
				};
			} catch (error) {
				console.error('Error sharing spreadsheet:', error);
				throw new Error(`Failed to share spreadsheet: ${error}`);
			}
		},
	});

	const colorSchema = z.union([
		z.string().regex(/^#[0-9A-Fa-f]{6}$/), // Hex color
		z.enum(['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'grey', 'black', 'white']), // Named colors
		z.object({
			red: z.number().min(0).max(1),
			green: z.number().min(0).max(1),
			blue: z.number().min(0).max(1),
			alpha: z.number().min(0).max(1).optional().default(1),
		}), // RGB object
	]);

	const formatCells = tool({
		description:
			'Format/highlight/color cells in a Google spreadsheet - use this ONLY when the user wants to change cell appearance, colors, fonts, borders, or alignment',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet to format'),
			range: z.string().describe('A1 notation range to format, e.g. "Sheet1!A1:B2"'),
			backgroundColor: colorSchema.optional().describe('Background color'),
			textColor: colorSchema.optional().describe('Text color'),
			bold: z.boolean().optional().describe('Whether text should be bold'),
			italic: z.boolean().optional().describe('Whether text should be italic'),
			underline: z.boolean().optional().describe('Whether text should be underlined'),
			strikethrough: z.boolean().optional().describe('Whether text should have strikethrough'),
			fontSize: z.number().int().positive().optional().describe('Font size in points'),
			fontFamily: z.string().optional().describe('Font family name (e.g., Arial, Times New Roman)'),
			horizontalAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional().describe('Horizontal alignment'),
			verticalAlignment: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional().describe('Vertical alignment'),
			wrapStrategy: z.enum(['OVERFLOW_CELL', 'LEGACY_WRAP', 'CLIP', 'WRAP']).optional().describe('Text wrapping strategy'),
			numberFormat: z
				.object({
					type: z.enum(['NUMBER', 'PERCENT', 'CURRENCY', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC']),
					pattern: z.string().optional(),
				})
				.optional()
				.describe('Number format settings'),
			borders: z
				.object({
					top: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
					bottom: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
					left: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
					right: z
						.object({
							style: z.enum(['NONE', 'SOLID', 'DASHED', 'DOTTED', 'DOUBLE']),
							width: z.number().int().positive().optional(),
							color: colorSchema.optional(),
						})
						.optional(),
				})
				.optional()
				.describe('Border settings'),
		}),
		execute: async (params) => {
			console.log('TOOL CALLED: formatCells');
			console.log('Formatting cells:', params);

			try {
				// Parse the range to get sheet name and A1 notation
				const [sheetName, a1Range] = params.range.includes('!') ? params.range.split('!') : ['Sheet1', params.range];

				// Get spreadsheet metadata to find sheet ID
				const spreadsheet = await sheets.spreadsheets.get({
					spreadsheetId: params.spreadsheetId,
				});

				const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === sheetName);
				if (!sheet || !sheet.properties?.sheetId) {
					throw new Error(`Sheet "${sheetName}" not found`);
				}

				// Convert A1 notation to GridRange
				const parseA1Notation = (a1: string) => {
					const match = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
					if (!match) throw new Error(`Invalid A1 notation: ${a1}`);

					const colToNum = (col: string) => {
						let num = 0;
						for (let i = 0; i < col.length; i++) {
							num = num * 26 + (col.charCodeAt(i) - 65 + 1);
						}
						return num - 1;
					};

					return {
						startRowIndex: parseInt(match[2]) - 1,
						startColumnIndex: colToNum(match[1]),
						endRowIndex: match[4] ? parseInt(match[4]) : parseInt(match[2]),
						endColumnIndex: match[3] ? colToNum(match[3]) + 1 : colToNum(match[1]) + 1,
					};
				};

				const gridRange = {
					sheetId: sheet.properties.sheetId,
					...parseA1Notation(a1Range),
				};

				// Build the cell format
				const cellFormat: any = {};

				// Background color
				if (params.backgroundColor) {
					cellFormat.backgroundColor = convertColorToRGB(params.backgroundColor);
				}

				// Text format
				const textFormat: any = {};
				if (params.textColor) textFormat.foregroundColor = convertColorToRGB(params.textColor);
				if (params.fontSize) textFormat.fontSize = params.fontSize;
				if (params.fontFamily) textFormat.fontFamily = params.fontFamily;
				if (params.bold !== undefined) textFormat.bold = params.bold;
				if (params.italic !== undefined) textFormat.italic = params.italic;
				if (params.underline !== undefined) textFormat.underline = params.underline;
				if (params.strikethrough !== undefined) textFormat.strikethrough = params.strikethrough;

				if (Object.keys(textFormat).length > 0) {
					cellFormat.textFormat = textFormat;
				}

				// Alignment
				if (params.horizontalAlignment) cellFormat.horizontalAlignment = params.horizontalAlignment;
				if (params.verticalAlignment) cellFormat.verticalAlignment = params.verticalAlignment;
				if (params.wrapStrategy) cellFormat.wrapStrategy = params.wrapStrategy;

				// Number format
				if (params.numberFormat) {
					cellFormat.numberFormat = {
						type: params.numberFormat.type,
						pattern: params.numberFormat.pattern,
					};
				}

				// Borders
				if (params.borders) {
					const borders: any = {};
					for (const [side, border] of Object.entries(params.borders)) {
						if (border) {
							borders[side] = {
								style: border.style,
								width: border.width,
								color: border.color ? convertColorToRGB(border.color) : undefined,
							};
						}
					}
					cellFormat.borders = borders;
				}

				// Make the API call
				const response = await sheets.spreadsheets.batchUpdate({
					spreadsheetId: params.spreadsheetId,
					requestBody: {
						requests: [
							{
								repeatCell: {
									range: gridRange,
									cell: {
										userEnteredFormat: cellFormat,
									},
									fields: Object.keys(cellFormat)
										.map((key) => `userEnteredFormat.${key}`)
										.join(','),
								},
							},
						],
					},
				});

				return {
					spreadsheetId: params.spreadsheetId,
					formattedRange: params.range,
					appliedFormats: Object.keys(params).filter(
						(key) => !['spreadsheetId', 'range'].includes(key) && params[key as keyof typeof params] !== undefined,
					),
				};
			} catch (error) {
				console.error('Error formatting cells:', error);
				throw new Error(`Failed to format cells: ${error}`);
			}
		},
	});

	// Helper function to convert color formats to Google Sheets RGB format
	function convertColorToRGB(color: any): { red: number; green: number; blue: number; alpha?: number } {
		if (typeof color === 'object') {
			return color;
		}

		// Handle hex colors
		if (color.startsWith('#')) {
			const hex = color.substring(1);
			return {
				red: parseInt(hex.substring(0, 2), 16) / 255,
				green: parseInt(hex.substring(2, 4), 16) / 255,
				blue: parseInt(hex.substring(4, 6), 16) / 255,
				alpha: 1,
			};
		}

		// Handle named colors
		const namedColors: Record<string, { red: number; green: number; blue: number }> = {
			red: { red: 1, green: 0, blue: 0 },
			blue: { red: 0, green: 0, blue: 1 },
			green: { red: 0, green: 1, blue: 0 },
			yellow: { red: 1, green: 1, blue: 0 },
			orange: { red: 1, green: 0.65, blue: 0 },
			purple: { red: 0.5, green: 0, blue: 0.5 },
			pink: { red: 1, green: 0.75, blue: 0.8 },
			brown: { red: 0.65, green: 0.16, blue: 0.16 },
			grey: { red: 0.5, green: 0.5, blue: 0.5 },
			black: { red: 0, green: 0, blue: 0 },
			white: { red: 1, green: 1, blue: 1 },
		};

		return { ...(namedColors[color.toLowerCase()] || namedColors.black), alpha: 1 };
	}

	const createColumnChart = tool({
		description: 'Create a column chart in a Google spreadsheet - use this when the user wants to create a column/bar chart',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			title: z.string().describe('Title of the chart'),
			sheetId: z.number().int().optional().describe('Sheet ID where chart will be placed (optional for new sheet)'),
			dataRange: z
				.object({
					sheetId: z.number().int().describe('Sheet ID containing the data'),
					startRow: z.number().int().min(0).describe('Start row index (0-based)'),
					endRow: z.number().int().describe('End row index (exclusive)'),
					startColumn: z.number().int().min(0).describe('Start column index (0-based)'),
					endColumn: z.number().int().describe('End column index (exclusive)'),
				})
				.describe('Range of data to chart'),
			legendPosition: z
				.enum(['BOTTOM_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'TOP_LEGEND', 'NO_LEGEND'])
				.optional()
				.default('BOTTOM_LEGEND')
				.describe('Position of the legend'),
			xAxisTitle: z.string().optional().describe('Title for the X axis'),
			yAxisTitle: z.string().optional().describe('Title for the Y axis'),
			position: z
				.object({
					newSheet: z.boolean().optional().describe('Create chart in a new sheet'),
					anchorCell: z
						.object({
							rowIndex: z.number().int().min(0).describe('Row index of anchor cell (0-based)'),
							columnIndex: z.number().int().min(0).describe('Column index of anchor cell (0-based)'),
						})
						.optional()
						.describe('Cell to anchor the chart (if not using new sheet)'),
				})
				.describe('Position of the chart'),
		}),
		execute: async (params) => {
			console.log('TOOL CALLED: createColumnChart');
			console.log('Creating column chart:', params);

			try {
				const requests: any[] = [
					{
						addChart: {
							chart: {
								spec: {
									title: params.title,
									basicChart: {
										chartType: 'COLUMN',
										legendPosition: params.legendPosition,
										axis: [
											...(params.xAxisTitle
												? [
														{
															position: 'BOTTOM_AXIS',
															title: params.xAxisTitle,
														},
													]
												: []),
											...(params.yAxisTitle
												? [
														{
															position: 'LEFT_AXIS',
															title: params.yAxisTitle,
														},
													]
												: []),
										],
										domains: [
											{
												domain: {
													sourceRange: {
														sources: [
															{
																sheetId: params.dataRange.sheetId,
																startRowIndex: params.dataRange.startRow,
																endRowIndex: params.dataRange.endRow,
																startColumnIndex: params.dataRange.startColumn,
																endColumnIndex: params.dataRange.startColumn + 1,
															},
														],
													},
												},
											},
										],
										series: Array.from({ length: params.dataRange.endColumn - params.dataRange.startColumn - 1 }, (_, i) => ({
											series: {
												sourceRange: {
													sources: [
														{
															sheetId: params.dataRange.sheetId,
															startRowIndex: params.dataRange.startRow,
															endRowIndex: params.dataRange.endRow,
															startColumnIndex: params.dataRange.startColumn + i + 1,
															endColumnIndex: params.dataRange.startColumn + i + 2,
														},
													],
												},
											},
											targetAxis: 'LEFT_AXIS',
										})),
										headerCount: 1,
									},
								},
								position: params.position.newSheet
									? { newSheet: true }
									: {
											overlayPosition: {
												anchorCell: {
													sheetId: params.sheetId!,
													rowIndex: params.position.anchorCell!.rowIndex,
													columnIndex: params.position.anchorCell!.columnIndex,
												},
											},
										},
							},
						},
					},
				];

				const response = await sheets.spreadsheets.batchUpdate({
					spreadsheetId: params.spreadsheetId,
					requestBody: { requests },
				});

				const chartId = response.data.replies?.[0]?.addChart?.chart?.chartId;
				return {
					success: true,
					chartId,
					spreadsheetId: params.spreadsheetId,
				};
			} catch (error) {
				console.error('Error creating column chart:', error);
				throw new Error(`Failed to create column chart: ${error}`);
			}
		},
	});

	const createPieChart = tool({
		description: 'Create a pie chart in a Google spreadsheet - use this when the user wants to create a pie chart',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			title: z.string().describe('Title of the chart'),
			sheetId: z.number().int().optional().describe('Sheet ID where chart will be placed'),
			dataRange: z
				.object({
					sheetId: z.number().int().describe('Sheet ID containing the data'),
					labelsStartRow: z.number().int().min(0).describe('Start row for labels (0-based)'),
					labelsEndRow: z.number().int().describe('End row for labels (exclusive)'),
					labelsColumn: z.number().int().min(0).describe('Column index for labels (0-based)'),
					valuesStartRow: z.number().int().min(0).describe('Start row for values (0-based)'),
					valuesEndRow: z.number().int().describe('End row for values (exclusive)'),
					valuesColumn: z.number().int().min(0).describe('Column index for values (0-based)'),
				})
				.describe('Range of data to chart'),
			legendPosition: z
				.enum(['BOTTOM_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'TOP_LEGEND', 'LABELED_LEGEND', 'NO_LEGEND'])
				.optional()
				.default('RIGHT_LEGEND')
				.describe('Position of the legend'),
			threeDimensional: z.boolean().optional().default(false).describe('Make it a 3D pie chart'),
			position: z
				.object({
					anchorCell: z
						.object({
							rowIndex: z.number().int().min(0).describe('Row index of anchor cell (0-based)'),
							columnIndex: z.number().int().min(0).describe('Column index of anchor cell (0-based)'),
						})
						.describe('Cell to anchor the chart'),
					offsetX: z.number().int().optional().default(0).describe('X offset in pixels'),
					offsetY: z.number().int().optional().default(0).describe('Y offset in pixels'),
				})
				.describe('Position of the chart'),
		}),
		execute: async (params) => {
			console.log('TOOL CALLED: createPieChart');
			console.log('Creating pie chart:', params);

			try {
				const requests: any[] = [
					{
						addChart: {
							chart: {
								spec: {
									title: params.title,
									pieChart: {
										legendPosition: params.legendPosition,
										threeDimensional: params.threeDimensional,
										domain: {
											sourceRange: {
												sources: [
													{
														sheetId: params.dataRange.sheetId,
														startRowIndex: params.dataRange.labelsStartRow,
														endRowIndex: params.dataRange.labelsEndRow,
														startColumnIndex: params.dataRange.labelsColumn,
														endColumnIndex: params.dataRange.labelsColumn + 1,
													},
												],
											},
										},
										series: {
											sourceRange: {
												sources: [
													{
														sheetId: params.dataRange.sheetId,
														startRowIndex: params.dataRange.valuesStartRow,
														endRowIndex: params.dataRange.valuesEndRow,
														startColumnIndex: params.dataRange.valuesColumn,
														endColumnIndex: params.dataRange.valuesColumn + 1,
													},
												],
											},
										},
									},
								},
								position: {
									overlayPosition: {
										anchorCell: {
											sheetId: params.sheetId || params.dataRange.sheetId,
											rowIndex: params.position.anchorCell.rowIndex,
											columnIndex: params.position.anchorCell.columnIndex,
										},
										offsetXPixels: params.position.offsetX,
										offsetYPixels: params.position.offsetY,
									},
								},
							},
						},
					},
				];

				const response = await sheets.spreadsheets.batchUpdate({
					spreadsheetId: params.spreadsheetId,
					requestBody: { requests },
				});

				const chartId = response.data.replies?.[0]?.addChart?.chart?.chartId;
				return {
					success: true,
					chartId,
					spreadsheetId: params.spreadsheetId,
				};
			} catch (error) {
				console.error('Error creating pie chart:', error);
				throw new Error(`Failed to create pie chart: ${error}`);
			}
		},
	});

	const createLineChart = tool({
		description: 'Create a line chart in a Google spreadsheet - use this when the user wants to create a line chart',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			title: z.string().optional().describe('Title of the chart'),
			sheetId: z.number().int().describe('Sheet ID where chart will be placed'),
			dataRanges: z
				.array(
					z.object({
						sheetId: z.number().int().describe('Sheet ID containing the data'),
						startRow: z.number().int().min(0).describe('Start row index (0-based)'),
						endRow: z.number().int().describe('End row index (exclusive)'),
						startColumn: z.number().int().min(0).describe('Start column index (0-based)'),
						endColumn: z.number().int().describe('End column index (exclusive)'),
					}),
				)
				.describe('Multiple ranges of data to chart (for non-adjacent ranges)'),
			legendPosition: z
				.enum(['BOTTOM_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'TOP_LEGEND', 'NO_LEGEND'])
				.optional()
				.describe('Position of the legend'),
			xAxisTitle: z.string().optional().describe('Title for the X axis'),
			position: z
				.object({
					anchorCell: z
						.object({
							rowIndex: z.number().int().min(0).describe('Row index of anchor cell (0-based)'),
							columnIndex: z.number().int().min(0).describe('Column index of anchor cell (0-based)'),
						})
						.describe('Cell to anchor the chart'),
				})
				.describe('Position of the chart'),
		}),
		execute: async (params) => {
			console.log('TOOL CALLED: createLineChart');
			console.log('Creating line chart:', params);

			try {
				// Build domain sources from all ranges (first column)
				const domainSources = params.dataRanges.map((range) => ({
					startRowIndex: range.startRow,
					endRowIndex: range.endRow,
					startColumnIndex: range.startColumn,
					endColumnIndex: range.startColumn + 1,
					sheetId: range.sheetId,
				}));

				// Build series sources from all ranges (second column)
				const seriesSources = params.dataRanges.map((range) => ({
					startRowIndex: range.startRow,
					endRowIndex: range.endRow,
					startColumnIndex: range.startColumn + 1,
					endColumnIndex: range.startColumn + 2,
					sheetId: range.sheetId,
				}));

				const requests: any[] = [
					{
						addChart: {
							chart: {
								spec: {
									...(params.title ? { title: params.title } : {}),
									basicChart: {
										chartType: 'LINE',
										...(params.legendPosition ? { legendPosition: params.legendPosition } : {}),
										...(params.xAxisTitle
											? {
													axis: [
														{
															position: 'BOTTOM_AXIS',
															title: params.xAxisTitle,
														},
													],
												}
											: {}),
										domains: [
											{
												domain: {
													sourceRange: {
														sources: domainSources,
													},
												},
											},
										],
										series: [
											{
												series: {
													sourceRange: {
														sources: seriesSources,
													},
												},
											},
										],
									},
								},
								position: {
									overlayPosition: {
										anchorCell: {
											sheetId: params.sheetId,
											rowIndex: params.position.anchorCell.rowIndex,
											columnIndex: params.position.anchorCell.columnIndex,
										},
									},
								},
							},
						},
					},
				];

				const response = await sheets.spreadsheets.batchUpdate({
					spreadsheetId: params.spreadsheetId,
					requestBody: { requests },
				});

				const chartId = response.data.replies?.[0]?.addChart?.chart?.chartId;
				return {
					success: true,
					chartId,
					spreadsheetId: params.spreadsheetId,
				};
			} catch (error) {
				console.error('Error creating line chart:', error);
				throw new Error(`Failed to create line chart: ${error}`);
			}
		},
	});

	const deleteChart = tool({
		description: 'Delete a chart from a Google spreadsheet - use this when the user wants to remove a chart',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			chartId: z.number().int().describe('ID of the chart to delete'),
		}),
		execute: async ({ spreadsheetId, chartId }) => {
			console.log('TOOL CALLED: deleteChart');
			console.log('Deleting chart:', { spreadsheetId, chartId });

			try {
				await sheets.spreadsheets.batchUpdate({
					spreadsheetId,
					requestBody: {
						requests: [
							{
								deleteEmbeddedObject: {
									objectId: chartId,
								},
							},
						],
					},
				});

				return {
					success: true,
					spreadsheetId,
					deletedChartId: chartId,
				};
			} catch (error) {
				console.error('Error deleting chart:', error);
				throw new Error(`Failed to delete chart: ${error}`);
			}
		},
	});

	const moveChart = tool({
		description: 'Move or resize a chart in a Google spreadsheet - use this when the user wants to reposition or resize a chart',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			chartId: z.number().int().describe('ID of the chart to move/resize'),
			sheetId: z.number().int().describe('Sheet ID where the chart is located'),
			anchorCell: z
				.object({
					rowIndex: z.number().int().min(0).describe('Row index of new anchor cell (0-based)'),
					columnIndex: z.number().int().min(0).describe('Column index of new anchor cell (0-based)'),
				})
				.describe('New anchor position'),
			offsetX: z.number().int().optional().describe('X offset in pixels from anchor cell'),
			offsetY: z.number().int().optional().describe('Y offset in pixels from anchor cell'),
			width: z.number().int().positive().optional().describe('New width in pixels'),
			height: z.number().int().positive().optional().describe('New height in pixels'),
		}),
		execute: async (params) => {
			console.log('TOOL CALLED: moveChart');
			console.log('Moving/resizing chart:', params);

			try {
				const newPosition: any = {
					overlayPosition: {
						anchorCell: {
							sheetId: params.sheetId,
							rowIndex: params.anchorCell.rowIndex,
							columnIndex: params.anchorCell.columnIndex,
						},
					},
				};

				let fields = 'anchorCell(rowIndex,columnIndex)';

				if (params.offsetX !== undefined) {
					newPosition.overlayPosition.offsetXPixels = params.offsetX;
					fields += ',offsetXPixels';
				}
				if (params.offsetY !== undefined) {
					newPosition.overlayPosition.offsetYPixels = params.offsetY;
					fields += ',offsetYPixels';
				}
				if (params.width !== undefined) {
					newPosition.overlayPosition.widthPixels = params.width;
					fields += ',widthPixels';
				}
				if (params.height !== undefined) {
					newPosition.overlayPosition.heightPixels = params.height;
					fields += ',heightPixels';
				}

				await sheets.spreadsheets.batchUpdate({
					spreadsheetId: params.spreadsheetId,
					requestBody: {
						requests: [
							{
								updateEmbeddedObjectPosition: {
									objectId: params.chartId,
									newPosition,
									fields,
								},
							},
						],
					},
				});

				return {
					success: true,
					spreadsheetId: params.spreadsheetId,
					chartId: params.chartId,
					newPosition: params.anchorCell,
					dimensions: {
						width: params.width,
						height: params.height,
					},
				};
			} catch (error) {
				console.error('Error moving/resizing chart:', error);
				throw new Error(`Failed to move/resize chart: ${error}`);
			}
		},
	});

	const getCharts = tool({
		description: 'Get all charts from a Google spreadsheet - use this when the user wants to see what charts exist',
		parameters: z.object({
			spreadsheetId: z.string().describe('ID of the spreadsheet'),
			sheetId: z.number().int().optional().describe('Optional: Get charts from a specific sheet only'),
		}),
		execute: async ({ spreadsheetId, sheetId }) => {
			console.log('TOOL CALLED: getCharts');
			console.log('Getting charts:', { spreadsheetId, sheetId });

			try {
				const response = await sheets.spreadsheets.get({
					spreadsheetId,
					fields: 'sheets(properties,charts)',
				});

				const allCharts: any[] = [];

				response.data.sheets?.forEach((sheet) => {
					if (sheetId !== undefined && sheet.properties?.sheetId !== sheetId) {
						return;
					}

					sheet.charts?.forEach((chart) => {
						allCharts.push({
							chartId: chart.chartId,
							sheetId: sheet.properties?.sheetId,
							sheetName: sheet.properties?.title,
							title: chart.spec?.title,
							chartType: chart.spec?.basicChart?.chartType || chart.spec?.pieChart ? 'PIE' : 'UNKNOWN',
							position: chart.position,
						});
					});
				});

				return {
					spreadsheetId,
					charts: allCharts,
					totalCharts: allCharts.length,
				};
			} catch (error) {
				console.error('Error getting charts:', error);
				throw new Error(`Failed to get charts: ${error}`);
			}
		},
	});

	return {
		createSpreadsheet,
		getValues,
		addSheet,
		listSpreadsheets,
		getSpreadsheet,
		deleteSpreadsheet,
		updateValues,
		deleteSheet,
		shareSpreadsheet,
		formatCells,
		createColumnChart,
		createPieChart,
		createLineChart,
		deleteChart,
		moveChart,
		getCharts,
	};
};
