import { createFileRoute } from "@tanstack/react-router";
import { parsePDF } from "@/lib/pdf-parser";
import { parseCSV } from "@/lib/csv-parser";

export const Route = createFileRoute("/api/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const formData = await request.formData();
					const files = formData.getAll("files") as File[];

					if (files.length === 0) {
						return Response.json(
							{
								status: "error",
								errorMessage: "No files provided",
								files: [],
							},
							{ status: 400 },
						);
					}

					const results = [];

					for (const file of files) {
						const isPDF = file.type === "application/pdf";
						const isCSV =
							file.type === "text/csv" ||
							file.type === "application/csv" ||
							file.name.endsWith(".csv");

						if (!isPDF && !isCSV) {
							results.push({
								filename: file.name,
								size: file.size,
								uploadDate: new Date().toISOString(),
								status: "error",
								errorMessage: "Only PDF and CSV files are accepted",
							});
							continue;
						}

						try {
							let parseResult;

							if (isPDF) {
								// Convert file to buffer for PDF parsing
								const arrayBuffer = await file.arrayBuffer();
								const buffer = Buffer.from(arrayBuffer);
								parseResult = await parsePDF(buffer);
							} else {
								// Parse CSV as text, passing filename for date extraction
								const text = await file.text();
								parseResult = await parseCSV(text, file.name);
							}

							if (parseResult.status === "error") {
								results.push({
									filename: file.name,
									size: file.size,
									uploadDate: new Date().toISOString(),
									status: "error",
									errorMessage: parseResult.errorMessage,
								});
								continue;
							}

							results.push({
								filename: file.name,
								size: file.size,
								uploadDate: new Date().toISOString(),
								status: "success",
								expenses: parseResult.expenses,
							});
						} catch (error) {
							results.push({
								filename: file.name,
								size: file.size,
								uploadDate: new Date().toISOString(),
								status: "error",
								errorMessage:
									error instanceof Error
										? error.message
										: "Failed to process file",
							});
						}
					}

					return Response.json({
						status: "success",
						files: results,
					});
				} catch (error) {
					return Response.json(
						{
							status: "error",
							errorMessage:
								error instanceof Error ? error.message : "Upload failed",
							files: [],
						},
						{ status: 500 },
					);
				}
			},
		},
	},
});
