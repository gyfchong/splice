import pdf from "pdf-parse";

export interface ParsedExpense {
	expenseId: string;
	name: string;
	amount: number;
	date: string; // YYYY-MM-DD
	year: number;
	month: string; // 2-digit format
}

export interface ParseResult {
	expenses: ParsedExpense[];
	status: "success" | "error";
	errorMessage?: string;
}

/**
 * Simple hash function for generating unique IDs
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Generate a unique ID for an expense based on its attributes
 */
function generateExpenseId(name: string, amount: number, date: string): string {
	const data = `${name}-${amount}-${date}`;
	return simpleHash(data);
}

/**
 * Parse a date string in various formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
	// Try common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
	const formats = [
		// MM/DD/YYYY or M/D/YYYY
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
		// DD-MMM-YYYY (e.g., 15-Jan-2024)
		/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
		// YYYY-MM-DD
		/^(\d{4})-(\d{1,2})-(\d{1,2})$/,
		// MMM DD, YYYY (e.g., Jan 15, 2024)
		/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/,
	];

	const monthMap: Record<string, string> = {
		jan: "01",
		feb: "02",
		mar: "03",
		apr: "04",
		may: "05",
		jun: "06",
		jul: "07",
		aug: "08",
		sep: "09",
		oct: "10",
		nov: "11",
		dec: "12",
	};

	for (const format of formats) {
		const match = dateStr.match(format);
		if (match) {
			// Handle different format types
			if (format.source.includes("\\/")) {
				// MM/DD/YYYY format
				const [, month, day, year] = match;
				const m = month.padStart(2, "0");
				const d = day.padStart(2, "0");
				return `${year}-${m}-${d}`;
			}
			if (format.source.includes("MMM")) {
				// Month name formats
				const [, monthOrDay, dayOrYear, year] = match;
				const monthName = monthOrDay.toLowerCase();
				if (monthMap[monthName]) {
					// MMM DD, YYYY
					return `${year}-${monthMap[monthName]}-${dayOrYear.padStart(2, "0")}`;
				}
				// DD-MMM-YYYY
				const day = monthOrDay;
				const month = monthMap[dayOrYear.toLowerCase()];
				return `${year}-${month}-${day.padStart(2, "0")}`;
			}
			if (format.source.startsWith("^\\(\\d\\{4\\}\\)")) {
				// YYYY-MM-DD
				const [, year, month, day] = match;
				return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
			}
		}
	}

	return null;
}

/**
 * Extract expenses from PDF text content
 * This is a generic parser that looks for common patterns in bank/credit card statements
 */
function extractExpenses(text: string): ParsedExpense[] {
	const expenses: ParsedExpense[] = [];
	const lines = text.split("\n");

	// Common patterns for credit card/bank statements:
	// Date | Description | Amount
	// We'll look for lines that contain dates and amounts

	const amountPattern = /\$?\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/;
	const datePattern =
		/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}\b/;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Look for lines that have both a date and an amount
		const dateMatch = line.match(datePattern);
		const amountMatch = line.match(amountPattern);

		if (dateMatch && amountMatch) {
			const dateStr = dateMatch[0];
			const amountStr = amountMatch[0].replace(/[$,\s]/g, "");
			const amount = Math.abs(Number.parseFloat(amountStr));

			// Extract the description (everything between date and amount)
			const dateIndex = line.indexOf(dateStr);
			const amountIndex = line.indexOf(amountMatch[0]);
			let description = line
				.substring(dateIndex + dateStr.length, amountIndex)
				.trim();

			// If description is empty, try to get it from the surrounding text
			if (!description) {
				description = line
					.replace(dateStr, "")
					.replace(amountMatch[0], "")
					.trim();
			}

			// Skip if we couldn't extract a meaningful description or amount
			if (!description || Number.isNaN(amount) || amount === 0) continue;

			const parsedDate = parseDate(dateStr);
			if (!parsedDate) continue;

			const [year, month] = parsedDate.split("-");
			const expenseId = generateExpenseId(description, amount, parsedDate);

			expenses.push({
				expenseId,
				name: description,
				amount,
				date: parsedDate,
				year: Number.parseInt(year, 10),
				month,
			});
		}
	}

	return expenses;
}

/**
 * Parse a PDF file buffer and extract expenses
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
	try {
		const data = await pdf(buffer);
		const expenses = extractExpenses(data.text);

		if (expenses.length === 0) {
			return {
				expenses: [],
				status: "error",
				errorMessage:
					"No expenses found in PDF. Please ensure the PDF is a valid bank or credit card statement.",
			};
		}

		return {
			expenses,
			status: "success",
		};
	} catch (error) {
		return {
			expenses: [],
			status: "error",
			errorMessage:
				error instanceof Error ? error.message : "Failed to parse PDF",
		};
	}
}
