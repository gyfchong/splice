/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as categorization from "../categorization.js";
import type * as categorizationWorker from "../categorizationWorker.js";
import type * as cronJobs from "../cronJobs.js";
import type * as crons from "../crons.js";
import type * as expenses from "../expenses.js";
import type * as heuristics from "../heuristics.js";
import type * as jobQueue from "../jobQueue.js";
import type * as rateLimit from "../rateLimit.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  categorization: typeof categorization;
  categorizationWorker: typeof categorizationWorker;
  cronJobs: typeof cronJobs;
  crons: typeof crons;
  expenses: typeof expenses;
  heuristics: typeof heuristics;
  jobQueue: typeof jobQueue;
  rateLimit: typeof rateLimit;
  utils: typeof utils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
