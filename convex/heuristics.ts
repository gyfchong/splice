/**
 * Heuristic-based expense categorization (Phase 3)
 *
 * Provides instant categorization for common merchants using keyword matching.
 * This reduces AI API calls and works offline.
 * Fallback used when rate limited or for common merchants.
 */

// Keyword mappings for common Australian merchants and transaction patterns
const CATEGORY_KEYWORDS = {
	Groceries: [
		"woolworths",
		"coles",
		"iga",
		"aldi",
		"foodworks",
		"spar",
		"foodland",
		"ritchies",
		"drakes",
		"harris farm",
		"fresh food",
		"fruit market",
		"butcher",
		"baker",
		"supermarket",
	],
	"Dining & Takeaway": [
		"mcdonald",
		"hungry jack",
		"kfc",
		"red rooster",
		"oporto",
		"grill'd",
		"nando's",
		"pizza",
		"domino",
		"subway",
		"sushi",
		"cafe",
		"restaurant",
		"bistro",
		"dining",
		"takeaway",
		"uber eats",
		"menulog",
		"doordash",
		"deliveroo",
		"chinese",
		"thai",
		"indian",
		"japanese",
		"italian",
		"vietnamese",
		"korean",
		"bar & grill",
		"pub",
		"hotel",
		"club",
	],
	Fuel: [
		"bp",
		"shell",
		"caltex",
		"ampol",
		"7-eleven",
		"7eleven",
		"mobil",
		"esso",
		"united petroleum",
		"metro petroleum",
		"costco fuel",
		"fuel",
		"petrol",
		"service station",
	],
	Transport: [
		"uber",
		"didi",
		"ola",
		"taxi",
		"13cabs",
		"train",
		"bus",
		"tram",
		"metro",
		"opal",
		"myki",
		"go card",
		"smartrider",
		"metcard",
		"transport",
		"parking",
		"toll",
		"e-tag",
		"etoll",
		"linkt",
	],
	"Bills & Utilities": [
		"telstra",
		"optus",
		"vodafone",
		"energy australia",
		"agl",
		"origin",
		"electricity",
		"gas",
		"water corporation",
		"sydney water",
		"yarra valley water",
		"internet",
		"nbn",
		"tpg",
		"iinet",
		"aussie broadband",
		"insurance",
		"council rates",
		"utilities",
	],
	Entertainment: [
		"netflix",
		"stan",
		"disney",
		"binge",
		"paramount",
		"spotify",
		"apple music",
		"youtube",
		"cinema",
		"hoyts",
		"event cinemas",
		"village",
		"reading cinemas",
		"theatre",
		"concert",
		"ticketek",
		"ticketmaster",
		"gaming",
		"playstation",
		"xbox",
		"nintendo",
		"steam",
	],
	Shopping: [
		"kmart",
		"target",
		"big w",
		"myer",
		"david jones",
		"best & less",
		"amazon",
		"ebay",
		"catch",
		"temple & webster",
		"ikea",
		"bunnings",
		"officeworks",
		"jb hi-fi",
		"harvey norman",
		"good guys",
		"rebel sport",
		"amart",
		"fantastic furniture",
		"chemist warehouse",
		"priceline",
		"chemist",
		"pharmacy",
	],
	"Health & Medical": [
		"medical centre",
		"doctors",
		"clinic",
		"hospital",
		"pathology",
		"radiology",
		"dentist",
		"dental",
		"physiotherapy",
		"physio",
		"chiropractic",
		"optometrist",
		"healthscope",
		"bupa",
		"medibank",
		"ramsay health",
		"laverty",
		"douglass hanly",
		"qml",
		"snp",
		"capital pathology",
	],
	"Home & Garden": [
		"bunnings",
		"mitre 10",
		"total tools",
		"masters",
		"hardware",
		"plumbing",
		"electrical",
		"garden",
		"nursery",
		"landscaping",
		"furniture",
		"manchester",
		"spotlight",
		"lincraft",
		"freedom",
		"beacon lighting",
	],
	Education: [
		"school",
		"university",
		"tafe",
		"college",
		"tuition",
		"textbooks",
		"bookshop",
		"stationery",
		"newsagent",
		"course",
		"training",
		"udemy",
		"coursera",
	],
	Travel: [
		"qantas",
		"virgin",
		"jetstar",
		"rex",
		"tigerair",
		"airline",
		"flight",
		"hotel",
		"booking.com",
		"airbnb",
		"expedia",
		"wotif",
		"accommodation",
		"hostel",
		"motel",
		"resort",
		"car rental",
		"hertz",
		"avis",
		"budget",
		"thrifty",
		"europcar",
	],
	Hobbies: [
		"gym",
		"fitness",
		"anytime fitness",
		"f45",
		"crossfit",
		"yoga",
		"pilates",
		"sports",
		"golf",
		"tennis",
		"bowling",
		"swimming",
		"climbing",
		"diving",
		"fishing",
		"craft",
		"art supplies",
		"hobby",
		"camera",
		"photo",
	],
}

/**
 * Attempts to categorize an expense using keyword heuristics
 *
 * @param merchantName - Normalized merchant name (e.g., "WOOLWORTHS")
 * @param description - Full expense description for additional context
 * @returns Category name if match found, null otherwise
 */
export function categorizeByHeuristics(
	merchantName: string,
	description: string,
): string | null {
	// Combine merchant name and description for matching
	const searchText = `${merchantName} ${description}`.toLowerCase()

	// Track matches with scores (for when multiple categories match)
	const categoryScores: Record<string, number> = {}

	// Check each category's keywords
	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
		let score = 0

		for (const keyword of keywords) {
			// Exact merchant name match (highest priority)
			if (merchantName.toLowerCase() === keyword.toLowerCase()) {
				score += 100
			}
			// Merchant name contains keyword
			else if (merchantName.toLowerCase().includes(keyword.toLowerCase())) {
				score += 50
			}
			// Description contains keyword
			else if (description.toLowerCase().includes(keyword.toLowerCase())) {
				score += 10
			}
		}

		if (score > 0) {
			categoryScores[category] = score
		}
	}

	// No matches found
	if (Object.keys(categoryScores).length === 0) {
		return null
	}

	// Return category with highest score
	const bestCategory = Object.entries(categoryScores).reduce((a, b) =>
		a[1] > b[1] ? a : b,
	)[0]

	return bestCategory
}

/**
 * Checks if a merchant is likely to be categorizable by heuristics
 * Used to decide whether to attempt AI categorization or use heuristics first
 *
 * @param merchantName - Normalized merchant name
 * @returns true if merchant is in common keywords list
 */
export function isCommonMerchant(merchantName: string): boolean {
	const lowerMerchant = merchantName.toLowerCase()

	for (const keywords of Object.values(CATEGORY_KEYWORDS)) {
		for (const keyword of keywords) {
			if (
				lowerMerchant === keyword.toLowerCase() ||
				lowerMerchant.includes(keyword.toLowerCase())
			) {
				return true
			}
		}
	}

	return false
}

/**
 * Gets statistics about heuristic coverage
 * Useful for monitoring and optimization
 *
 * @returns Object with category counts and keyword counts
 */
export function getHeuristicStats() {
	const stats = {
		categoryCount: Object.keys(CATEGORY_KEYWORDS).length,
		totalKeywords: 0,
		keywordsPerCategory: {} as Record<string, number>,
	}

	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
		stats.keywordsPerCategory[category] = keywords.length
		stats.totalKeywords += keywords.length
	}

	return stats
}
