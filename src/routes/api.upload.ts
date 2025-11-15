import { createFileRoute } from "@tanstack/react-router";
import { parsePDF } from "@/lib/pdf-parser";

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
						if (file.type !== "application/pdf") {
							results.push({
								filename: file.name,
								size: file.size,
								uploadDate: new Date().toISOString(),
								status: "error",
								errorMessage: "Only PDF files are accepted",
							});
							continue;
						}

						try {
							// Convert file to buffer
							const arrayBuffer = await file.arrayBuffer();
							const buffer = Buffer.from(arrayBuffer);

							// Parse PDF
							const parseResult = await parsePDF(buffer);

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
